import { afterEach, describe, expect, it, vi } from "vitest";

import ApiGateway from "./ApiGateway";
import { API_BASE } from "./config";

function stubFetch(response: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}) {
  const fetchStub = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchStub);

  return fetchStub;
}

describe("ApiGateway", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gets a dto from the api", async () => {
    const fetchStub = stubFetch({
      ok: true,
      status: 200,
      json: async () => [{ name: "Dune" }],
    });

    const dto = await new ApiGateway().get("/");

    expect(fetchStub).toHaveBeenCalledWith(`${API_BASE}/`);
    expect(dto).toEqual([{ name: "Dune" }]);
  });

  it("posts a json payload to the api", async () => {
    const fetchStub = stubFetch({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    });

    const dto = await new ApiGateway().post("/", { name: "Dune" });

    expect(fetchStub).toHaveBeenCalledWith(`${API_BASE}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dune" }),
    });
    expect(dto).toEqual({ status: "ok" });
  });

  it("fails when the api responds with an error status", async () => {
    stubFetch({ ok: false, status: 500, json: async () => ({}) });

    await expect(new ApiGateway().get("/")).rejects.toThrow(
      "Request failed with status 500",
    );
  });
});
