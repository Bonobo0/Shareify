# Changelog

## v2.12.0 - Client-Security Enhancements

### 🔒 Security Improvements

#### HMAC-SHA256 Integrity Verification (v2 Encryption Format)
- Added HMAC-SHA256 based integrity verification for new encrypted files
- v2 format header: `[version 1B][mode 1B][salt 16B][counter 16B][HMAC 32B][chunk count 4B]`
- Detects tampering and provides stronger authentication than previous SHA-256 authTag
- New `.encrypted` files use v2 format by default

#### scrypt Key Derivation (Optional)
- Added scrypt-based key derivation option (memory-hard, GPU-resistant)
- Parameters: N=2^16, r=16, p=1
- Falls back to PBKDF2 (100k iterations) if scrypt is not supported by browser
- Enabled via `useScrypt: true` option in `encryptFile()`

#### Password Strength Validation
- Added `validatePasswordStrength()` utility function
- Minimum 12 characters required
- Requires 2+ character types (uppercase/lowercase/numbers/special characters)
- Checks against common password blacklist
- Real-time strength indicator in upload UI (weak/medium/strong)

#### Password Confirmation Input
- Added password confirmation field in upload options
- Passwords must match before upload is enabled
- Visual feedback for password mismatch

#### Encryption Version Management
- Added `ENCRYPTION_VERSION` constant (V1=1, V2=2)
- V2 is default for new encryptions
- Full backward compatibility: V1 files (AES-GCM, AES-CTR) can still be decrypted
- Version byte in header enables automatic format detection during decryption

### 🔄 Backward Compatibility
- All existing V1 encrypted files remain fully decryptable
- V1 decryption path unchanged (AES-GCM and AES-CTR authTag verification)
- New V2 files are only produced when using updated encryption code
- Metadata includes `version` and `useScrypt` fields for proper decryption

### 📝 API Changes

#### `encryptFile(file, password, options)`
- New `options` parameter:
  - `options.useScrypt` (boolean, default false): Use scrypt key derivation
  - `options.version` (ENCRYPTION_VERSION, default V2): Encryption format version
- Metadata now includes `version` and `useScrypt` fields

#### `decryptFile(encryptedArrayBuffer, password, originalMetadata)`
- Automatically detects V1/V2 format from header
- V2: Verifies HMAC-SHA256 before decryption
- `originalMetadata.useScrypt` used for scrypt-encrypted files (backward compatible)

#### `deriveKeyFromPassword(password, salt, algorithm, useScrypt)`
- New `useScrypt` parameter (boolean, default false)
- Falls back to PBKDF2 if scrypt unsupported

#### `validatePasswordStrength(password)` (NEW)
- Returns `{ isValid: boolean, errors: string[] }`
- Checks length, complexity, and common passwords

### 📄 Files Modified
- `src/lib/crypto/encryption.js` - Core encryption module (V2 format, HMAC, scrypt, validation)
- `src/app/components/fileUploader/UploadOptions.jsx` - Password confirmation, strength indicator
- `src/app/components/fileUploader.jsx` - Password validation integration

### 🔐 Security Notes
- scrypt is only used when explicitly enabled (`useScrypt: true`) to avoid compatibility issues
- PBKDF2 remains the default key derivation (100k iterations, unchanged)
- HMAC verification in V2 is mandatory and cannot be skipped
