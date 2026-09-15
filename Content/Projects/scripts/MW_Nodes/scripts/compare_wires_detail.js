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

const game = decodeGia('./uploads/compare/signal_test_game.gia');
const lua3 = decodeGia('./uploads/compare/LUA3_Signal_test_.gia');

console.log('================ GAME WIRES ================');
game.graph.graph.inner.graph.nodes.forEach(n => {
  n.pins?.forEach((p, pidx) => {
    (p.connects || []).forEach(c => {
      console.log(`Node ${n.nodeIndex} pin #${pidx} (${p.i1?.kind}, ${p.i1?.index}) -> Node ${c.id} pin (${c.connect?.kind}, ${c.connect?.index})`);
    });
  });
});

console.log('\n================ LUA3 WIRES ================');
lua3.graph.graph.inner.graph.nodes.forEach(n => {
  n.pins?.forEach((p, pidx) => {
    (p.connects || []).forEach(c => {
      console.log(`Node ${n.nodeIndex} pin #${pidx} (${p.i1?.kind}, ${p.i1?.index}) -> Node ${c.id} pin (${c.connect?.kind}, ${c.connect?.index})`);
    });
  });
});
