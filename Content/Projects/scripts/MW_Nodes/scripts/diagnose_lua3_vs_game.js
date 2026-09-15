import fs from 'fs';
import vm from 'vm';
import { NODE_ID } from '../src/ide/utils/MW-Node-Editor-Pack/node_data/node_id.js';

const protobufJsCode = fs.readFileSync('./src/ide/utils/protobufjs.min.js', 'utf8');
const context = { window: {}, global: {}, console, Uint8Array, ArrayBuffer, Buffer };
vm.createContext(context);
vm.runInContext(protobufJsCode, context);
const protobuf = context.window.protobuf || context.protobuf;

const protoText = fs.readFileSync('./src/ide/utils/MW-Node-Editor-Pack/protobuf/gia.proto', 'utf8');
const root = protobuf.parse(protoText).root;
const Type = root.lookupType('Root');

function decodeGia(filePath) {
  const buf = fs.readFileSync(filePath);
  const u8 = new context.Uint8Array(buf.buffer, buf.byteOffset + 20, buf.length - 24);
  const msg = Type.decode(u8);
  return Type.toObject(msg, { defaults: true, longs: Number });
}

const gameAst = decodeGia('./uploads/compare/signal_test_game.gia');
const lua3Ast = decodeGia('./uploads/compare/LUA3_Signal_test_.gia');

const revMap = {};
for (const [k, v] of Object.entries(NODE_ID)) {
  if (!revMap[v]) revMap[v] = [];
  revMap[v].push(k);
}

function getNodeName(n) {
  const gName = revMap[n.genericId?.nodeId]?.[0] || '';
  const cName = revMap[n.concreteId?.nodeId]?.[0] || '';
  return `${gName} / ${cName}`;
}

console.log('============= GAME NODES LIST =============');
gameAst.graph.graph.inner.graph.nodes.forEach(n => {
  console.log(`Node [${n.nodeIndex}] Gen:${n.genericId?.nodeId} Conc:${n.concreteId?.nodeId} Name: ${getNodeName(n)} Pins:${n.pins?.length}`);
});

console.log('\n============= LUA3 NODES LIST =============');
lua3Ast.graph.graph.inner.graph.nodes.forEach(n => {
  console.log(`Node [${n.nodeIndex}] Gen:${n.genericId?.nodeId} Conc:${n.concreteId?.nodeId} Name: ${getNodeName(n)} Pins:${n.pins?.length}`);
});

console.log('\n============= DETAILED COMPARISON BY TOPIC =============');

console.log('\n--- 1. ADDITION & 3D VECTOR ---');
// find nodes with genericId 200 (addition) or vector 3d (genericId 225)
[gameAst, lua3Ast].forEach((ast, i) => {
  const label = i === 0 ? 'GAME' : 'LUA3';
  console.log(`\n=== ${label} Addition & 3D Vector Nodes ===`);
  ast.graph.graph.inner.graph.nodes.forEach(n => {
    const name = getNodeName(n);
    if (name.includes('ADD') || name.includes('VECTOR') || n.genericId?.nodeId === 200 || n.genericId?.nodeId === 225) {
      console.log(`[${label}] Node idx:${n.nodeIndex} Gen:${n.genericId?.nodeId} Conc:${n.concreteId?.nodeId} (${name})`);
      n.pins?.forEach((p, pidx) => {
        console.log(`   Pin #${pidx}: i1=(${p.i1?.kind}, ${p.i1?.index}) i2=(${p.i2?.kind}, ${p.i2?.index}) type=${p.type} val=${JSON.stringify(p.value)} connects=${JSON.stringify(p.connects)}`);
      });
    }
  });
});

console.log('\n--- 2 & 3. FINITE LOOP (Start, End, Loop Body, Loop Complete) ---');
[gameAst, lua3Ast].forEach((ast, i) => {
  const label = i === 0 ? 'GAME' : 'LUA3';
  console.log(`\n=== ${label} Finite Loop Nodes ===`);
  ast.graph.graph.inner.graph.nodes.forEach(n => {
    const name = getNodeName(n);
    if (name.includes('LOOP') || n.genericId?.nodeId === 252) {
      console.log(`[${label}] Node idx:${n.nodeIndex} Gen:${n.genericId?.nodeId} Conc:${n.concreteId?.nodeId} (${name})`);
      n.pins?.forEach((p, pidx) => {
        console.log(`   Pin #${pidx}: i1=(${p.i1?.kind}, ${p.i1?.index}) i2=(${p.i2?.kind}, ${p.i2?.index}) type=${p.type} val=${JSON.stringify(p.value)} connects=${JSON.stringify(p.connects)}`);
      });
    }
  });
});

console.log('\n--- 4. LIST SORTING & ENUM ---');
[gameAst, lua3Ast].forEach((ast, i) => {
  const label = i === 0 ? 'GAME' : 'LUA3';
  console.log(`\n=== ${label} List Sorting Nodes ===`);
  ast.graph.graph.inner.graph.nodes.forEach(n => {
    const name = getNodeName(n);
    if (name.includes('SORT') || name.includes('LIST')) {
      console.log(`[${label}] Node idx:${n.nodeIndex} Gen:${n.genericId?.nodeId} Conc:${n.concreteId?.nodeId} (${name})`);
      n.pins?.forEach((p, pidx) => {
        console.log(`   Pin #${pidx}: i1=(${p.i1?.kind}, ${p.i1?.index}) i2=(${p.i2?.kind}, ${p.i2?.index}) type=${p.type} val=${JSON.stringify(p.value)} connects=${JSON.stringify(p.connects)}`);
      });
    }
  });
});
