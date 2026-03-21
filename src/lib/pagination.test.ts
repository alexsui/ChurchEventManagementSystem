import { describe, it, expect } from "vitest";
import { parsePaginationParams, paginatedResponse } from "./pagination";

describe("parsePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });

  it("parses page and limit", () => {
    const params = new URLSearchParams({ page: "3", limit: "20" });
    expect(parsePaginationParams(params)).toEqual({ page: 3, limit: 20, skip: 40 });
  });

  it("caps limit at 100", () => {
    const params = new URLSearchParams({ limit: "999" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it("floors page at 1", () => {
    const params = new URLSearchParams({ page: "0" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });

  it("handles non-numeric values as defaults", () => {
    const params = new URLSearchParams({ page: "abc", limit: "xyz" });
    expect(parsePaginationParams(params)).toEqual({ page: 1, limit: 40, skip: 0 });
  });
});

describe("paginatedResponse", () => {
  it("builds response with correct totalPages", () => {
    const result = paginatedResponse(["a", "b"], 50, 1, 40);
    expect(result).toEqual({ data: ["a", "b"], total: 50, page: 1, limit: 40, totalPages: 2 });
  });

  it("calculates totalPages correctly for exact division", () => {
    const result = paginatedResponse([], 80, 1, 40);
    expect(result.totalPages).toBe(2);
  });

  it("handles zero total", () => {
    const result = paginatedResponse([], 0, 1, 40);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 40, totalPages: 0 });
  });
});
