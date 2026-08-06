import { test } from "node:test";
import assert from "node:assert/strict";
import { toGraph, toDot } from "../tools/model.js";

const scene = {
  elements: [
    {
      id: "n1",
      type: "rectangle",
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      boundElements: [
        { type: "text", id: "t1" },
        { type: "arrow", id: "a1" },
      ],
    },
    { id: "t1", type: "text", text: "Hello", containerId: "n1" },
    {
      id: "n2",
      type: "ellipse",
      x: 200,
      y: 0,
      width: 80,
      height: 80,
      boundElements: [{ type: "arrow", id: "a1" }],
    },
    {
      id: "a1",
      type: "arrow",
      startBinding: { elementId: "n1" },
      endBinding: { elementId: "n2" },
      endArrowhead: "arrow",
    },
    { id: "gone", type: "rectangle", isDeleted: true },
  ],
};

test("toGraph extracts nodes with their bound-text labels", () => {
  const g = toGraph(scene);
  assert.equal(g.nodes.length, 2);
  const n1 = g.nodes.find((n) => n.id === "n1");
  assert.equal(n1.label, "Hello");
  assert.equal(n1.shape, "rectangle");
});

test("toGraph extracts a directed edge between two nodes", () => {
  const g = toGraph(scene);
  assert.equal(g.edges.length, 1);
  assert.equal(g.edges[0].from, "n1");
  assert.equal(g.edges[0].to, "n2");
  assert.equal(g.edges[0].directed, true);
});

test("toGraph ignores deleted elements", () => {
  const g = toGraph(scene);
  assert.ok(!g.nodes.some((n) => n.id === "gone"));
});

test("toGraph drops arrows not connecting two nodes", () => {
  const s = {
    elements: [
      { id: "n1", type: "rectangle", boundElements: [] },
      {
        id: "a1",
        type: "arrow",
        startBinding: { elementId: "n1" },
        endBinding: { elementId: "missing" },
      },
    ],
  };
  assert.equal(toGraph(s).edges.length, 0);
});

test("toDot renders labels and edges", () => {
  const dot = toDot(toGraph(scene));
  assert.match(dot, /digraph \{/);
  assert.match(dot, /label="Hello"/);
  assert.match(dot, /"n1" -> "n2"/);
});
