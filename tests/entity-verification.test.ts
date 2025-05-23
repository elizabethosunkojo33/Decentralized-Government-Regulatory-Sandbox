import { describe, it, expect, beforeEach } from 'vitest';

// Mock the Clarity contract environment
const mockClarity = () => {
  const state = {
    admin: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
    entities: new Map(),
    blockHeight: 100
  };
  
  return {
    state,
    tx: {
      sender: state.admin
    },
    blockHeight: () => state.blockHeight,
    incrementBlockHeight: () => { state.blockHeight += 1; },
    setTxSender: (sender) => {
      return {
        tx: { sender },
        blockHeight: () => state.blockHeight
      };
    },
    contract: {
      registerEntity: (name, context = { tx: { sender: state.admin } }) => {
        const caller = context.tx.sender;
        if (state.entities.has(caller)) {
          return { err: 1 };
        }
        
        state.entities.set(caller, {
          status: 1, // pending
          name,
          'registration-date': state.blockHeight,
          'verification-date': 0,
          verifier: caller
        });
        
        return { ok: true };
      },
      verifyEntity: (entity, context = { tx: { sender: state.admin } }) => {
        const caller = context.tx.sender;
        if (caller !== state.admin) {
          return { err: 2 };
        }
        
        if (!state.entities.has(entity)) {
          return { err: 3 };
        }
        
        const entityData = state.entities.get(entity);
        state.entities.set(entity, {
          ...entityData,
          status: 2, // verified
          'verification-date': state.blockHeight,
          verifier: caller
        });
        
        return { ok: true };
      },
      rejectEntity: (entity, context = { tx: { sender: state.admin } }) => {
        const caller = context.tx.sender;
        if (caller !== state.admin) {
          return { err: 2 };
        }
        
        if (!state.entities.has(entity)) {
          return { err: 3 };
        }
        
        const entityData = state.entities.get(entity);
        state.entities.set(entity, {
          ...entityData,
          status: 3, // rejected
          'verification-date': state.blockHeight,
          verifier: caller
        });
        
        return { ok: true };
      },
      isVerified: (entity) => {
        if (!state.entities.has(entity)) {
          return false;
        }
        
        return state.entities.get(entity).status === 2;
      },
      getEntity: (entity) => {
        if (!state.entities.has(entity)) {
          return null;
        }
        
        return state.entities.get(entity);
      },
      setAdmin: (newAdmin, context = { tx: { sender: state.admin } }) => {
        const caller = context.tx.sender;
        if (caller !== state.admin) {
          return { err: 2 };
        }
        
        state.admin = newAdmin;
        return { ok: true };
      }
    }
  };
};

describe('Entity Verification Contract', () => {
  let clarity;
  
  beforeEach(() => {
    clarity = mockClarity();
  });
  
  it('should register a new entity', () => {
    const result = clarity.contract.registerEntity('Test Entity');
    expect(result).toEqual({ ok: true });
    
    const entity = clarity.contract.getEntity(clarity.tx.sender);
    expect(entity).toEqual({
      status: 1,
      name: 'Test Entity',
      'registration-date': 100,
      'verification-date': 0,
      verifier: clarity.tx.sender
    });
  });
  
  it('should not register an entity twice', () => {
    clarity.contract.registerEntity('Test Entity');
    const result = clarity.contract.registerEntity('Test Entity Again');
    expect(result).toEqual({ err: 1 });
  });
  
  it('should verify an entity as admin', () => {
    const user = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const userContext = clarity.setTxSender(user);
    
    clarity.contract.registerEntity('User Entity', userContext);
    const result = clarity.contract.verifyEntity(user);
    
    expect(result).toEqual({ ok: true });
    expect(clarity.contract.isVerified(user)).toBe(true);
    
    const entity = clarity.contract.getEntity(user);
    expect(entity.status).toBe(2);
    expect(entity['verification-date']).toBe(100);
    expect(entity.verifier).toBe(clarity.state.admin);
  });
  
  it('should reject an entity as admin', () => {
    const user = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const userContext = clarity.setTxSender(user);
    
    clarity.contract.registerEntity('User Entity', userContext);
    const result = clarity.contract.rejectEntity(user);
    
    expect(result).toEqual({ ok: true });
    expect(clarity.contract.isVerified(user)).toBe(false);
    
    const entity = clarity.contract.getEntity(user);
    expect(entity.status).toBe(3);
  });
  
  it('should not allow non-admin to verify entity', () => {
    const user1 = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const user2 = 'ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC';
    
    const user1Context = clarity.setTxSender(user1);
    const user2Context = clarity.setTxSender(user2);
    
    clarity.contract.registerEntity('User1 Entity', user1Context);
    const result = clarity.contract.verifyEntity(user1, user2Context);
    
    expect(result).toEqual({ err: 2 });
    expect(clarity.contract.isVerified(user1)).toBe(false);
  });
  
});
