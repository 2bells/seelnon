import fs from 'fs';
import vm from 'vm';

const protobufJsCode = fs.readFileSync('./src/ide/utils/protobufjs.min.js', 'utf8');
const context = { window: {}, global: {}, console, Uint8Array, ArrayBuffer, Buffer };
vm.createContext(context);
vm.runInContext(protobufJsCode, context);
const protobuf = context.window.protobuf || context.protobuf;

const protoText = fs.readFileSync('./src/ide/utils/MW-Node-Editor-Pack/protobuf/gia.proto', 'utf8');
const root = protobuf.parse(protoText).root;
const Type = root.lookupType('Root');

globalThis.window = {
  protobuf,
  rootProto: root,
  TypeRoot: Type
};

const { GiaCodec } = await import('../src/giaCodec.js');
const { GraphState } = await import('../src/graphState.js');

const state = new GraphState();
const n1 = state.createNode('op_assembly_list', 100, 100);
state.setPinType(n1.id, '0', 'int');
state.setInputValue(n1.id, '0', '42');
state.addDynamicInput(n1.id);
state.setInputValue(n1.id, '1', '99');

const n2 = state.createNode('op_assembly_list', 400, 100);
state.setPinType(n2.id, '0', 'float');
state.setInputValue(n2.id, '0', '3.14');

const ast = GiaCodec._graphStateToAst(state);
const graphNodes = ast.graph.graph.inner.graph.nodes;
console.log('Exported AST Graph Nodes count:', graphNodes.length);
graphNodes.forEach((gn, i) => {
  console.log(`Node #${i+1} generic:${gn.genericId?.nodeId} concrete:${gn.concreteId?.nodeId} pinsCount:${gn.pins.length}`);
  console.log(`  Pin 0:`, JSON.stringify(gn.pins[0]));
  console.log(`  Pin 1:`, JSON.stringify(gn.pins[1]));
  console.log(`  Pin 2:`, JSON.stringify(gn.pins[2]));
  console.log(`  Pin 101:`, JSON.stringify(gn.pins[101]));
});

const buf = GiaCodec.exportToBuffer(state);
console.log('\nEncoded binary size:', buf.byteLength);

// Decode
const decoded = GiaCodec.importFromBuffer(buf);
console.log('Decoded nodes count:', decoded.nodes.length);
decoded.nodes.forEach(n => {
  console.log(`Decoded node: ${n.name} dataType:${n.dataType} pinTypes:`, n.pinTypes, 'dynamicInputs:', n.dynamicInputs, 'inputValues:', n.inputValues);
});
