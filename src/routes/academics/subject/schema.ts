import { RouteShorthandOptions } from "fastify";

export const listSubjectsSchema: RouteShorthandOptions["schema"] = {
  querystring: {
    type: "object",
    properties: {
      page: { type: "number", minimum: 1, default: 1 },
      limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
      sem: { type: "string" },
      type: { type: "string", enum: ["Theory", "Practical"] },
      scheme: { type: "string" },
      department: { type: "string" },
    },
  },
};

export const getSubjectByIdSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const createSubjectSchema: RouteShorthandOptions["schema"] = {
  body: {
    type: "object",
    required: ["name", "sem", "subject_code", "type", "total_marks", "pass_mark", "scheme", "department"],
    properties: {
      name: { type: "string", minLength: 1 },
      sem: { type: "string", minLength: 1 },
      subject_code: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["Theory", "Practical"] },
      total_marks: { type: "number", minimum: 0 },
      pass_mark: { type: "number", minimum: 0 },
      scheme: { type: "string", minLength: 1 },
      department: { type: "string", minLength: 1 },
    },
  },
};

export const updateSubjectSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  body: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      sem: { type: "string", minLength: 1 },
      subject_code: { type: "string", minLength: 1 },
      type: { type: "string", enum: ["Theory", "Practical"] },
      total_marks: { type: "number", minimum: 0 },
      pass_mark: { type: "number", minimum: 0 },
      scheme: { type: "string", minLength: 1 },
      department: { type: "string", minLength: 1 },
    },
  },
};

export const deleteSubjectSchema: RouteShorthandOptions["schema"] = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
