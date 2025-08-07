# Shareify - File Sharing Platform

Shareify is a Next.js full-stack web application for anonymous file sharing with features including 2FA, email verification, file encryption, directory management, and user authentication. Built with Next.js 14.1.4, TailwindCSS, DaisyUI, MongoDB, and Cloudflare R2 storage.

**Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Dependencies
```bash
# Install dependencies (choose one)
npm install    # Takes ~2.5 minutes. NEVER CANCEL. Set timeout to 5+ minutes.
# OR
yarn install   # Takes ~1.5 minutes. NEVER CANCEL. Set timeout to 3+ minutes.
```

**Both npm and yarn are supported** - package-lock.json and yarn.lock both exist.

### Environment Configuration (REQUIRED)
The application **REQUIRES** environment variables to run. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with required values:
# - JWT_SECRET (mandatory - at least 32 characters)
# - MONGODB_URI (database connection)
# - R2_* variables (Cloudflare R2 storage)
# - EMAIL_* variables (email service)
# - NEXT_PUBLIC_APP_URL
```

**Without .env file, the application will crash with JWT_SECRET error.**

### Building
```bash
# CRITICAL: Google Fonts Network Restriction Issue
npm run build  # FAILS in sandboxed environments due to fonts.googleapis.com access
yarn build     # Same Google Fonts issue
```

**Known Issue:** Build fails with `Failed to fetch 'Inter' from Google Fonts` in network-restricted environments.

**Workaround for Sandboxed Environments:**
1. Temporarily comment out Google Fonts import in `src/app/layout.jsx`:
   ```javascript
   // import { Inter } from "next/font/google";  // Comment this out
   // const inter = Inter({ subsets: ["latin"] }); // Comment this out
   ```
2. Remove font class from body element:
   ```javascript
   <body className="">  {/* Remove {inter.className} */}
   ```
3. Build will succeed in ~25 seconds. NEVER CANCEL. Set timeout to 60+ minutes for safety.
4. Restore original layout.jsx after build if needed.

### Development Server
```bash
npm run dev    # Starts in ~2 seconds on http://localhost:3000
# OR
yarn dev
```
Requires .env file to be configured. Without it, returns HTTP 500 error.

### Production Server
```bash
npm run start  # Starts in ~0.4 seconds after successful build
# OR  
yarn start
```
Requires successful `npm run build` first.

### Linting
```bash
npm run lint   # Takes ~4 seconds. Shows warnings about <img> elements (normal)
# OR
yarn lint
```

## Validation

### Manual Testing Scenarios
After making changes, **ALWAYS** test these key user flows:

1. **Application Startup:**
   - Verify app loads at http://localhost:3000
   - Check for HTTP 200 response (not 500 error)
   - Confirm Korean language UI displays correctly

2. **Navigation Flow:**
   - Test navigation between login/signup pages
   - Verify header and footer load properly
   - Check theme toggle functionality

3. **Critical User Paths:**
   - Access login page (/user/signin)
   - Access signup page (/user/signup)
   - Test form field interactions
   - Verify terms/privacy policy links work

### Environment Validation
- Always verify .env file exists before running dev/build
- Test both development and production modes when making changes
- Confirm MongoDB connection settings if modifying database code

## Common Tasks and File Locations

### Key Project Structure
```
src/
├── app/                 # Next.js App Router pages
│   ├── components/      # Reusable UI components
│   ├── auth/           # Authentication pages
│   ├── dashboard/      # User dashboard
│   ├── profile/        # User profile management
│   └── share/          # File sharing functionality
├── lib/                # Utility libraries
│   ├── auth/           # Authentication utilities (JWT, etc.)
│   ├── db/             # Database connection and utilities
│   ├── email/          # Email service integration
│   ├── crypto/         # Encryption utilities
│   └── r2/             # Cloudflare R2 storage utilities
├── models/             # Database models (MongoDB)
├── actions/            # Server actions
└── context/            # React context providers
```

### Important Configuration Files
- `package.json` - Dependencies and scripts
- `.env.example` - Environment variable template
- `next.config.mjs` - Next.js configuration (ignores build errors)
- `tailwind.config.js` - TailwindCSS + DaisyUI configuration
- `.eslintrc.json` - ESLint configuration

### Dependencies and Technology Stack
- **Framework:** Next.js 14.1.4
- **Styling:** TailwindCSS + DaisyUI
- **Database:** MongoDB (via mongoose)
- **File Storage:** Cloudflare R2 (AWS SDK)
- **Authentication:** JWT (jose library)
- **Email:** nodemailer
- **Encryption:** bcryptjs, speakeasy (2FA)
- **File Handling:** file-saver, jszip

## Critical Timing and Timeout Information

**NEVER CANCEL** any of these commands before the specified timeouts:

- `npm install`: 2.5 minutes typical, **set 5+ minute timeout**
- `yarn install`: 1.5 minutes typical, **set 3+ minute timeout**
- `npm run build / yarn build`: 25 seconds typical, **set 60+ minute timeout** (builds can take much longer in some environments)
- `npm run dev`: 2 seconds startup, **set 30+ second timeout**
- `npm run start`: 0.4 seconds startup, **set 30+ second timeout**
- `npm run lint`: 4 seconds typical, **set 60+ second timeout**

## Development Notes

### Known Issues and Workarounds
1. **Google Fonts:** Fails in sandboxed environments - use workaround above
2. **No Test Suite:** Project has no automated tests - rely on manual validation
3. **Environment Dependencies:** App won't start without proper .env configuration
4. **ESLint Warnings:** Image optimization warnings are normal and expected

### Code Quality Notes
- Project built with AI assistance (GitHub Copilot Agent)
- Code quality may vary - planned for future refactoring
- Next.js configuration ignores build errors and ESLint issues during builds

### Before Committing Changes
- Always run `npm run lint` to check for issues
- Test dev server startup with your changes
- Perform manual validation of affected user flows
- Verify environment variables are properly configured

## Package Manager Notes
Both npm and yarn are supported, but **do not mix** package managers:
- If using npm: use `npm install`, `npm run build`, etc.
- If using yarn: use `yarn install`, `yarn build`, etc.
- Mixing them can cause lock file conflicts