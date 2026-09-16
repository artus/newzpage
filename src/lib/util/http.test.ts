import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertPublicUrl, isPrivateAddress } from "./http";

describe("isPrivateAddress", () => {
  it("recognises loopback, private and link-local ranges", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.1.1", "0.0.0.0", "100.64.0.1", "::1", "fc00::1", "fd12::1", "fe80::1", "::ffff:10.0.0.1"]) {
      assert.equal(isPrivateAddress(address), true, address);
    }
    for (const address of ["8.8.8.8", "172.32.0.1", "151.101.1.69", "2606:4700::1111", "::ffff:8.8.8.8"]) {
      assert.equal(isPrivateAddress(address), false, address);
    }
  });
});

describe("assertPublicUrl", () => {
  it("refuses local names, private addresses and other schemes", async () => {
    delete process.env.NEWZPAGE_ALLOW_PRIVATE_URLS;
    await assert.rejects(assertPublicUrl("http://localhost:3000/"), /Local addresses/);
    await assert.rejects(assertPublicUrl("http://printer.local/"), /Local addresses/);
    await assert.rejects(assertPublicUrl("http://127.0.0.1/"), /Private addresses/);
    await assert.rejects(assertPublicUrl("http://[::1]/"), /Private addresses/);
    await assert.rejects(assertPublicUrl("ftp://example.org/"), /Only http/);
    await assert.rejects(assertPublicUrl("not a url"), /Not a valid URL/);
  });

  it("can be switched off for home networks", async () => {
    process.env.NEWZPAGE_ALLOW_PRIVATE_URLS = "1";
    assert.equal((await assertPublicUrl("http://localhost:3000/")).hostname, "localhost");
    delete process.env.NEWZPAGE_ALLOW_PRIVATE_URLS;
  });
});
