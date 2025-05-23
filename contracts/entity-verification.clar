;; Entity Verification Contract
;; Validates participating businesses in the regulatory sandbox

(define-data-var admin principal tx-sender)

;; Entity status: 0 = unverified, 1 = pending, 2 = verified, 3 = rejected
(define-map entities principal
  {
    status: uint,
    name: (string-utf8 100),
    registration-date: uint,
    verification-date: uint,
    verifier: principal
  }
)

;; Register a new entity (can be done by the entity itself)
(define-public (register-entity (name (string-utf8 100)))
  (let ((caller tx-sender))
    (asserts! (is-none (map-get? entities caller)) (err u1)) ;; Entity already exists
    (ok (map-set entities caller
      {
        status: u1, ;; pending
        name: name,
        registration-date: block-height,
        verification-date: u0,
        verifier: caller
      }
    ))
  )
)

;; Verify an entity (admin only)
(define-public (verify-entity (entity principal))
  (let ((caller tx-sender))
    (asserts! (is-eq caller (var-get admin)) (err u2)) ;; Not admin
    (asserts! (is-some (map-get? entities entity)) (err u3)) ;; Entity doesn't exist
    (ok (map-set entities entity
      (merge (unwrap-panic (map-get? entities entity))
        {
          status: u2, ;; verified
          verification-date: block-height,
          verifier: caller
        }
      )
    ))
  )
)

;; Reject an entity (admin only)
(define-public (reject-entity (entity principal))
  (let ((caller tx-sender))
    (asserts! (is-eq caller (var-get admin)) (err u2)) ;; Not admin
    (asserts! (is-some (map-get? entities entity)) (err u3)) ;; Entity doesn't exist
    (ok (map-set entities entity
      (merge (unwrap-panic (map-get? entities entity))
        {
          status: u3, ;; rejected
          verification-date: block-height,
          verifier: caller
        }
      )
    ))
  )
)

;; Check if an entity is verified
(define-read-only (is-verified (entity principal))
  (let ((entity-data (map-get? entities entity)))
    (if (is-some entity-data)
      (is-eq (get status (unwrap-panic entity-data)) u2) ;; status = verified
      false
    )
  )
)

;; Get entity details
(define-read-only (get-entity (entity principal))
  (map-get? entities entity)
)

;; Transfer admin rights (admin only)
(define-public (set-admin (new-admin principal))
  (let ((caller tx-sender))
    (asserts! (is-eq caller (var-get admin)) (err u2)) ;; Not admin
    (ok (var-set admin new-admin))
  )
)
