# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability within this project, please send an email to the maintainers. All security vulnerabilities will be promptly addressed.

**Please do not use public GitHub issues for security vulnerabilities.**

## Security Practices

### Credential Storage
- ✅ Credentials are stored securely using the system keychain (keytar)
- ✅ No credentials are hardcoded in source code
- ✅ Environment variables are used only during initial setup
- ✅ All API requests use proper authentication headers

### Data Protection
- ✅ All network requests use HTTPS
- ✅ API responses are properly validated using Effect Schema
- ✅ Error messages do not expose sensitive information
- ✅ Input sanitization via `encodeURIComponent` for URL parameters

### Development Security
- ✅ Test mocks prevent accidental calls to production APIs
- ✅ No real credentials in test files
- ✅ Security audit integration with dependency checking

### Known Issues
- ⚠️ **Development Dependencies**: Some indirect dev dependencies (ast-grep) have known vulnerabilities but do not affect production usage
- ✅ **Production Dependencies**: All runtime dependencies are regularly updated and audited

## Security Features

1. **Secure Credential Storage**: Uses system keychain via keytar
2. **Input Validation**: All user inputs validated with Effect Schema
3. **Network Security**: HTTPS-only, proper error handling
4. **Test Safety**: Mocks prevent accidental API calls during testing
5. **No Sensitive Data Logging**: Error messages sanitized

## Security Guidelines for Contributors

1. **Never commit credentials** - Use environment variables only
2. **Use example domains** in tests and documentation
3. **Validate all inputs** using Effect Schema
4. **Handle errors securely** - Don't expose sensitive info
5. **Update dependencies** regularly for security patches

## Audit History

- **2025-01-XX**: Initial security audit completed
  - Removed hardcoded sensitive references
  - Implemented secure credential storage
  - Added test safety measures
  - Validated all network security practices

## Dependencies

The project minimizes dependencies for security:
- Core: Effect, keytar, commander
- Dev: Biome, oxlint, TypeScript, Bun
- No unnecessary third-party dependencies