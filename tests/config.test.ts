import { readPositiveIntEnv } from '../src/config';

describe('config parsing', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    test('uses fallback when env missing', () => {
        delete process.env.TEST_ENV_MISSING;
        expect(readPositiveIntEnv('TEST_ENV_MISSING', 123)).toBe(123);
    });

    test('uses parsed positive integer', () => {
        process.env.TEST_ENV_OK = '42';
        expect(readPositiveIntEnv('TEST_ENV_OK', 7)).toBe(42);
    });

    test('uses fallback when env is invalid', () => {
        process.env.TEST_ENV_BAD = 'not-a-number';
        expect(readPositiveIntEnv('TEST_ENV_BAD', 9)).toBe(9);
    });

    test('uses fallback when env is non-positive', () => {
        process.env.TEST_ENV_ZERO = '0';
        expect(readPositiveIntEnv('TEST_ENV_ZERO', 9)).toBe(9);
    });
});
