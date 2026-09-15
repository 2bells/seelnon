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

const revMap = {};
for (const [k, v] of Object.entries(NODE_ID)) {
  if (!revMap[v]) revMap[v] = [];
  revMap[v].push(k);
}

console.log('=== GAME NODES ===');
gameAst.graph.graph.inner.graph.nodes.forEach((n, idx) => {
  const gName = revMap[n.genericId?.nodeId]?.join(' / ') || 'unknown';
  const cName = revMap[n.concreteId?.nodeId]?.join(' / ') || 'unknown';
  console.log(`\nNode #${idx+1} (idx:${n.nodeIndex}) pos:(${n.x}, ${n.y}) Generic:${n.genericId?.nodeId} [${gName}] Concrete:${n.concreteId?.nodeId} [${cName}]`);
  console.log(`  Total pins: ${n.pins?.length}`);
  n.pins?.forEach((p, pidx) => {
    console.log(`    [p${pidx}] i1:(${p.i1?.kind},${p.i1?.index}) i2:(${p.i2?.kind},${p.i2?.index}) type:${p.type} connects:${JSON.stringify(p.connects)} val:${JSON.stringify(p.value)}`);
  });
});
