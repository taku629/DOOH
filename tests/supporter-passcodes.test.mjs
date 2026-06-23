import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { verifySupporterPasscode } from "../src/supporter-passcodes.js";

const validConfig = {
  enabled: true,
  codes: {
    "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4": {
      label: "supporter-01",
    },
  },
};

test("accepts a configured 4-digit supporter passcode", async () => {
  const result = await verifySupporterPasscode("1234", { config: validConfig });

  assert.equal(result.ok, true);
  assert.equal(result.label, "supporter-01");
  assert.equal(result.codeHash, "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4");
});

test("normalizes non-digit characters before verification", async () => {
  const result = await verifySupporterPasscode("12-34", { config: validConfig });

  assert.equal(result.ok, true);
});

test("rejects disabled or unknown supporter passcodes", async () => {
  const disabled = await verifySupporterPasscode("1234", {
    config: { enabled: false, codes: validConfig.codes },
  });
  const unknown = await verifySupporterPasscode("9999", { config: validConfig });

  assert.equal(disabled.ok, false);
  assert.equal(disabled.reason, "disabled");
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "not_found");
});

test("accepts all configured demo supporter passcodes", async () => {
  const config = JSON.parse(fs.readFileSync(new URL("../config/supporter-passcodes.json", import.meta.url), "utf8"));
  const demoCodes = [
    "1234",
    "5678",
    "9012",
    "3456",
    "1122",
    "2233",
    "3344",
    "4455",
    "5566",
    "6677",
    "7788",
    "8899",
    "1212",
    "2323",
    "3434",
    "4545",
  ];

  const results = await Promise.all(demoCodes.map((code) => verifySupporterPasscode(code, { config })));

  assert.deepEqual(results.map((result) => result.ok), demoCodes.map(() => true));
});
