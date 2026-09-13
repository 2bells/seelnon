/**
 * Miliastra Wonderland Node Graph - Server Nodes Registry
 * Aggregates Event, Execution, Flow, Operation, and Query nodes from modular
 * part files (each category is split into smaller files for easier loading).
 */

import { EVENT_NODES_A } from "./eventNodes.a.js";
import { EVENT_NODES_B } from "./eventNodes.b.js";

import { EXECUTION_NODES_A } from "./executionNodes.a.js";
import { EXECUTION_NODES_B } from "./executionNodes.b.js";
import { EXECUTION_NODES_C } from "./executionNodes.c.js";
import { EXECUTION_NODES_D } from "./executionNodes.d.js";
import { EXECUTION_NODES_E } from "./executionNodes.e.js";

import { QUERY_NODES_A } from "./queryNodes.a.js";
import { QUERY_NODES_B } from "./queryNodes.b.js";
import { QUERY_NODES_C } from "./queryNodes.c.js";

import { FLOW_NODES } from "./flowNodes.js";
import { OPERATION_NODES } from "./operationNodes.js";

export const EVENT_NODES = [...EVENT_NODES_A, ...EVENT_NODES_B];
export const EXECUTION_NODES = [...EXECUTION_NODES_A, ...EXECUTION_NODES_B, ...EXECUTION_NODES_C, ...EXECUTION_NODES_D, ...EXECUTION_NODES_E];
export const QUERY_NODES = [...QUERY_NODES_A, ...QUERY_NODES_B, ...QUERY_NODES_C];
export { FLOW_NODES };
export { OPERATION_NODES };

export const ALL_SERVER_NODES = [
  ...EVENT_NODES,
  ...EXECUTION_NODES,
  ...FLOW_NODES,
  ...OPERATION_NODES,
  ...QUERY_NODES
];
