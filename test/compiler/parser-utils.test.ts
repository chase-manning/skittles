import { describe, it, expect } from "vitest";
import { getEnumMemberName, getNodeName } from "../../src/compiler/parser-utils";
import ts from "typescript";

function makeEnumMember(code: string): ts.EnumMember {
  const src = ts.createSourceFile(
    "t.ts",
    `enum E { ${code} }`,
    ts.ScriptTarget.Latest,
    true
  );
  const decl = src.statements[0] as ts.EnumDeclaration;
  return decl.members[0];
}

function makeNode(code: string): ts.Node {
  const src = ts.createSourceFile(
    "t.ts",
    code,
    ts.ScriptTarget.Latest,
    true
  );
  return src.statements[0];
}

describe("getEnumMemberName", () => {
  it("returns the name of an identifier enum member", () => {
    const member = makeEnumMember("Foo");
    expect(getEnumMemberName(member)).toBe("Foo");
  });

  it("returns 'Unknown' for a computed enum member", () => {
    const member = makeEnumMember('"computed-key" = 1');
    expect(getEnumMemberName(member)).toBe("Unknown");
  });
});

describe("getNodeName", () => {
  it("returns the name of a class declaration", () => {
    const node = makeNode("class MyClass {}");
    expect(getNodeName(node)).toBe("MyClass");
  });

  it("returns the name of an enum declaration", () => {
    const node = makeNode("enum MyEnum { A, B }");
    expect(getNodeName(node)).toBe("MyEnum");
  });

  it("returns the text of an identifier node", () => {
    const src = ts.createSourceFile(
      "t.ts",
      "foo;",
      ts.ScriptTarget.Latest,
      true
    );
    const stmt = src.statements[0] as ts.ExpressionStatement;
    expect(getNodeName(stmt.expression)).toBe("foo");
  });

  it("returns 'Unknown' for a node without a name", () => {
    const node = makeNode("1 + 2;");
    expect(getNodeName(node)).toBe("Unknown");
  });
});
