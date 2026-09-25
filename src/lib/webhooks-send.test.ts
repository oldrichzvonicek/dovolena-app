import { describe, expect, it } from "vitest";
import { assertPublicHost, isNonPublicIp } from "./webhooks-send";

describe("isNonPublicIp", () => {
  it("blocks private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.0.0.5", "127.0.0.1", "172.16.4.1", "172.31.255.255", "192.168.1.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "fd12:3456::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isNonPublicIp(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"]) {
      expect(isNonPublicIp(ip), ip).toBe(false);
    }
  });
});

describe("assertPublicHost", () => {
  it("refuses literal private IPs", async () => {
    expect(await assertPublicHost("192.168.0.1")).not.toBeNull();
  });
  it("refuses names that resolve to loopback", async () => {
    expect(await assertPublicHost("localhost")).not.toBeNull();
  });
});
