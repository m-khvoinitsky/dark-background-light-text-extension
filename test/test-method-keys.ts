import { strict as assert } from 'assert';
import { describe } from 'mocha';
import { methods } from '../src/methods/methods';

describe('Ensure method IDs are consistent', () => {
  Object.entries(methods).forEach(([key, val]) => {
    it(val.label, () => {
      assert(
        key === val.number,
        `${val.label} key (${key}) does not match its number (${val.number})`,
      );
    });
  });
});
