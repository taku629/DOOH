import assert from "node:assert/strict";
import test from "node:test";

import { verifySupporterPasscode } from "../src/supporter-passcodes.js";

const validConfig = {
  enabled: true,
  codes: {
    d9a5223b761c375d1263e6e57ebec42d3e0fe3f6f283488d2eb204fb6ff17ee5: {
      label: "supporter-01",
    },
  },
};

test("accepts a configured 4-digit supporter passcode", async () => {
  const result = await verifySupporterPasscode("1029", { config: validConfig });

  assert.equal(result.ok, true);
  assert.equal(result.label, "supporter-01");
  assert.equal(result.codeHash, "d9a5223b761c375d1263e6e57ebec42d3e0fe3f6f283488d2eb204fb6ff17ee5");
});

test("normalizes non-digit characters before verification", async () => {
  const result = await verifySupporterPasscode("10-29", { config: validConfig });

  assert.equal(result.ok, true);
});

test("rejects disabled or unknown supporter passcodes", async () => {
  const disabled = await verifySupporterPasscode("1029", {
    config: { enabled: false, codes: validConfig.codes },
  });
  const unknown = await verifySupporterPasscode("9999", { config: validConfig });

  assert.equal(disabled.ok, false);
  assert.equal(disabled.reason, "disabled");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "not_found");
});
