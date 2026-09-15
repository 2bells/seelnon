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

function decodeGia(filePath) {
  const buf = fs.readFileSync(filePath);
  const u8 = new context.Uint8Array(buf.buffer, buf.byteOffset + 20, buf.length - 24);
  const msg = Type.decode(u8);
  return Type.toObject(msg, { defaults: true, longs: Number });
}

const gameAst = decodeGia('./uploads/compare/signal_test_game.gia');
const luaAst = decodeGia('./uploads/compare/signal_test_LUA_2.gia');

console.log('=== GAME ACCESSORIES ===');
console.log(JSON.stringify(gameAst.accessories, null, 2));

console.log('=== GAME NODES ===');
gameAst.graph.graph.inner.graph.nodes.forEach((n, idx) => {
  console.log(`Node #${idx+1} [${n.nodeIndex}] generic:`, n.genericId?.nodeId, 'concrete:', n.concreteId?.nodeId, 'pins count:', n.pins?.length);
  n.pins?.forEach((p, pidx) => {
    console.log(`   Pin #${pidx}: i1=(${p.i1?.kind}, ${p.i1?.index}) i2=(${p.i2?.kind}, ${p.i2?.index}) type=${p.type} connects=${JSON.stringify(p.connects)} val=${JSON.stringify(p.value)}`);
  });
});

console.log('\n=== LUA NODES ===');
luaAst.graph.graph.inner.graph.nodes.forEach((n, idx) => {
  console.log(`Node #${idx+1} [${n.nodeIndex}] generic:`, n.genericId?.nodeId, 'concrete:', n.concreteId?.nodeId, 'pins count:', n.pins?.length);
  n.pins?.forEach((p, pidx) => {
    console.log(`   Pin #${pidx}: i1=(${p.i1?.kind}, ${p.i1?.index}) i2=(${p.i2?.kind}, ${p.i2?.index}) type=${p.type} connects=${JSON.stringify(p.connects)} val=${JSON.stringify(p.value)}`);
  });
});
