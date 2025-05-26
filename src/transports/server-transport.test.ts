import ServerTransport from "./server-transport";

describe("Server transport test", () => {

  class DummyTransport extends ServerTransport {

  }

  it("transport implementation throws without start", async () => {
    await expect(async () => { await new DummyTransport().start(); }).rejects.toThrowError();
  });

  it("throws if no router is configured", async () => {
    const t = new DummyTransport();
    await expect(t['routerHandler']({ jsonrpc: "2.0", id: "1", method: "foo", params: [] }))
      .rejects.toThrow("No router configured");
  });

  it("returns method not found if method is not implemented", async () => {
    const t = new DummyTransport();
    // Mock a router that doesn't implement any method
    const fakeRouter = { isMethodImplemented: () => false, call: jest.fn() } as unknown as import("../router").Router;
    t.addRouter(fakeRouter);
    const result = await t['routerHandler']({ jsonrpc: "2.0", id: "1", method: "foo", params: [] });
    expect(result.error).toBeDefined();
    expect(result.error?.code).toBe(-32601); // Method not found
  });

  it("returns result if method is implemented", async () => {
    const t = new DummyTransport();
    const fakeRouter = {
      isMethodImplemented: () => true,
      call: async () => ({ result: 42 }),
    } as unknown as import("../router").Router;
    t.addRouter(fakeRouter);
    const result = await t['routerHandler']({ jsonrpc: "2.0", id: "1", method: "bar", params: [] });
    expect(result.result).toBe(42);
  });

  it("covers the no router configured branch in routerHandler", async () => {
    class DummyTransport extends ServerTransport {}
    const t = new DummyTransport();
    await expect(
      t['routerHandler']({ jsonrpc: "2.0", id: "no-router", method: "foo", params: [] })
    ).rejects.toThrow("No router configured");
  });

  it("throws if stop is not implemented", async () => {
    class DummyTransport extends ServerTransport {}
    const t = new DummyTransport();
    await expect(t.stop()).rejects.toThrow("Transport missing stop implementation");
  });

});
