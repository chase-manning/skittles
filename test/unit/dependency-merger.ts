import { expect } from "chai";
import { FileData } from "../../src/compiler/get-file-data";
import {
  mergeConstants,
  mergeFunctions,
  mergeInterfaces,
} from "../../src/compiler/dependency-merger";
import {
  SkittlesConstants,
  SkittlesInterfaces,
  SkittlesMethod,
} from "../../src/types/skittles-contract";
import { SkittlesExpressionType } from "../../src/types/skittles-expression";
import { SkittlesTypeKind } from "../../src/types/skittles-type";

describe("Dependency Merger", () => {
  const createMockFileData = (
    path: string,
    changed: boolean,
    dependencies: string[],
    interfaces: SkittlesInterfaces = {},
    constants: SkittlesConstants = {},
    functions: SkittlesMethod[] = []
  ): FileData => {
    return {
      path,
      hash: 0,
      fileContent: "",
      changed,
      dependencies,
      ast: {} as any,
      interfaces,
      constants,
      functions,
      contracts: [],
    };
  };

  describe("mergeInterfaces", () => {
    it("should merge interfaces from dependencies when file is changed", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", true, ["/file2.ts"], {
          interface1: { name: "Interface1", elements: [] },
        }),
        createMockFileData("/file2.ts", false, [], {
          interface2: { name: "Interface2", elements: [] },
        }),
      ];

      const result = mergeInterfaces(fileData);

      expect(result[0].interfaces).to.have.property("interface1");
      expect(result[0].interfaces).to.have.property("interface2");
      expect(Object.keys(result[0].interfaces)).to.have.length(2);
    });

    it("should not merge interfaces when file is not changed", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", false, ["/file2.ts"], {
          interface1: { name: "Interface1", elements: [] },
        }),
        createMockFileData("/file2.ts", false, [], {
          interface2: { name: "Interface2", elements: [] },
        }),
      ];

      const result = mergeInterfaces(fileData);

      expect(result[0].interfaces).to.have.property("interface1");
      expect(result[0].interfaces).to.not.have.property("interface2");
      expect(Object.keys(result[0].interfaces)).to.have.length(1);
    });

    it("should throw error when dependency is not found", () => {
      const fileData: FileData[] = [createMockFileData("/file1.ts", true, ["/missing.ts"], {})];

      expect(() => mergeInterfaces(fileData)).to.throw("Dependency /missing.ts not found");
    });

    it("should handle multiple dependencies", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", true, ["/file2.ts", "/file3.ts"], {
          interface1: { name: "Interface1", elements: [] },
        }),
        createMockFileData("/file2.ts", false, [], {
          interface2: { name: "Interface2", elements: [] },
        }),
        createMockFileData("/file3.ts", false, [], {
          interface3: { name: "Interface3", elements: [] },
        }),
      ];

      const result = mergeInterfaces(fileData);

      expect(result[0].interfaces).to.have.property("interface1");
      expect(result[0].interfaces).to.have.property("interface2");
      expect(result[0].interfaces).to.have.property("interface3");
      expect(Object.keys(result[0].interfaces)).to.have.length(3);
    });
  });

  describe("mergeConstants", () => {
    it("should merge constants from dependencies when file is changed", () => {
      const fileData: FileData[] = [
        createMockFileData(
          "/file1.ts",
          true,
          ["/file2.ts"],
          {},
          { constant1: { expressionType: SkittlesExpressionType.Number, value: 1 } }
        ),
        createMockFileData(
          "/file2.ts",
          false,
          [],
          {},
          { constant2: { expressionType: SkittlesExpressionType.Number, value: 2 } }
        ),
      ];

      const result = mergeConstants(fileData);

      expect(result[0].constants).to.have.property("constant1");
      expect(result[0].constants).to.have.property("constant2");
      expect(Object.keys(result[0].constants)).to.have.length(2);
    });

    it("should not merge constants when file is not changed", () => {
      const fileData: FileData[] = [
        createMockFileData(
          "/file1.ts",
          false,
          ["/file2.ts"],
          {},
          { constant1: { expressionType: SkittlesExpressionType.Number, value: 1 } }
        ),
        createMockFileData(
          "/file2.ts",
          false,
          [],
          {},
          { constant2: { expressionType: SkittlesExpressionType.Number, value: 2 } }
        ),
      ];

      const result = mergeConstants(fileData);

      expect(result[0].constants).to.have.property("constant1");
      expect(result[0].constants).to.not.have.property("constant2");
      expect(Object.keys(result[0].constants)).to.have.length(1);
    });

    it("should throw error when dependency is not found", () => {
      const fileData: FileData[] = [createMockFileData("/file1.ts", true, ["/missing.ts"], {}, {})];

      expect(() => mergeConstants(fileData)).to.throw("Dependency /missing.ts not found");
    });
  });

  describe("mergeFunctions", () => {
    const createMockFunction = (name: string): SkittlesMethod => ({
      name,
      returns: { kind: SkittlesTypeKind.Void },
      private: false,
      view: false,
      parameters: [],
      statements: [],
    });

    it("should merge functions from dependencies when file is changed", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", true, ["/file2.ts"], {}, {}, [createMockFunction("func1")]),
        createMockFileData("/file2.ts", false, [], {}, {}, [createMockFunction("func2")]),
      ];

      const result = mergeFunctions(fileData);

      expect(result[0].functions).to.have.length(2);
      expect(result[0].functions.map((f) => f.name)).to.include("func1");
      expect(result[0].functions.map((f) => f.name)).to.include("func2");
    });

    it("should not merge functions when file is not changed", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", false, ["/file2.ts"], {}, {}, [
          createMockFunction("func1"),
        ]),
        createMockFileData("/file2.ts", false, [], {}, {}, [createMockFunction("func2")]),
      ];

      const result = mergeFunctions(fileData);

      expect(result[0].functions).to.have.length(1);
      expect(result[0].functions[0].name).to.equal("func1");
    });

    it("should throw error when dependency is not found", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", true, ["/missing.ts"], {}, {}, []),
      ];

      expect(() => mergeFunctions(fileData)).to.throw("Dependency /missing.ts not found");
    });

    it("should handle multiple dependencies", () => {
      const fileData: FileData[] = [
        createMockFileData("/file1.ts", true, ["/file2.ts", "/file3.ts"], {}, {}, [
          createMockFunction("func1"),
        ]),
        createMockFileData("/file2.ts", false, [], {}, {}, [createMockFunction("func2")]),
        createMockFileData("/file3.ts", false, [], {}, {}, [createMockFunction("func3")]),
      ];

      const result = mergeFunctions(fileData);

      expect(result[0].functions).to.have.length(3);
      expect(result[0].functions.map((f) => f.name)).to.include("func1");
      expect(result[0].functions.map((f) => f.name)).to.include("func2");
      expect(result[0].functions.map((f) => f.name)).to.include("func3");
    });
  });
});
