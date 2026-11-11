# Code Coverage Requirements

This project maintains a **minimum code coverage threshold of 80%** to ensure code quality and reliability.

## Coverage Goals

- **Global Minimum:** 75% coverage for statements, lines, and functions
- **Branch Coverage:** 75% minimum (complex routes may have different thresholds)
- **Ideal Target:** 100% coverage whenever possible
- **Exceptions:** Files with complex external dependencies may have adjusted thresholds


## File-Specific Thresholds

Some files have specific coverage requirements based on their complexity:

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| applicationRoutes.js | 70% | 70% | 90% | 80% |
| jobRoutes.js | 75% | 75% | 90% | 80% |
| resumeRoutes.js | 70% | 70% | 90% | 80% |
| profilePictureRoutes.js | 90% | 90% | 100% | 90% |

## Excluded Files

The following files are excluded from coverage requirements due to complex external dependencies:

- `src/routes/chatRoutes.js` - AI integration, complex mocking
- `src/utils/documentText.js` - External document parsing libraries

## Running Coverage Tests

To generate a coverage report locally:

```bash
cd server
npm run test:coverage
```

Coverage reports are generated in `server/coverage/`:
- `coverage/index.html` - Interactive HTML report
- `coverage/lcov.info` - LCOV format for CI/CD tools

## CI/CD Integration

The GitHub Actions pipeline automatically:

1. ✅ Runs all unit and integration tests
2. ✅ Generates coverage reports
3. ✅ Checks if coverage meets the 80% threshold
4. ✅ Uploads results to Codecov
5. ❌ **Fails the build if coverage falls below thresholds**

## Pull Request Requirements

For pull requests to be merged:

- All tests must pass
- Code coverage must meet or exceed the 80% minimum
- New code should aim for 100% coverage
- Coverage check must be a **required status check**

## Improving Coverage

### Identify Gaps

Look for uncovered lines in the coverage report:

```bash
cd server
npm run test:coverage
open coverage/index.html  # View interactive report
```

### Focus Areas

High-priority coverage improvements:

1. **Branch Coverage** - Currently at 74.22%
   - Focus on conditional logic (if/else, switch statements)
   - Test both success and error paths

2. **Routes** - Most critical for application behavior
   - Test success scenarios (200, 201)
   - Test error scenarios (400, 403, 404, 500)
   - Test edge cases and validation

3. **Complex Logic** - Routes with business logic
   - applicationRoutes.js - Authorization checks
   - jobRoutes.js - Job filtering and aggregation
   - resumeRoutes.js - File upload validation

## Best Practices

- Write tests **before** fixing bugs or adding features
- Aim for behavior-driven testing (test the "why", not the "how")
- Use mocking for external dependencies
- Test both happy paths and error conditions
- Keep test files close to source files

## Resources

- Jest Documentation: https://jestjs.io/
- Coverage Reports: See `coverage/index.html` after running tests
- Test Examples: See `server/src/**/*.test.js` and `server/tests/`

## Questions?

If you have questions about coverage requirements, check:
1. This file (COVERAGE.md)
2. Jest configuration: `server/jest.config.cjs`
3. GitHub Actions: `.github/workflows/test-pipeline.yaml`
4. Existing test files for examples
