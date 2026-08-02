import { describe, expect, it } from 'vitest';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../doc/fixtures/transaction-verification.json'
);

const readUint64LittleEndian = (bytes: Uint8Array, offset: number) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, true);

describe('transaction primitive fixture', () => {
  it('independently checks every Symbol transfer Catbuffer boundary', () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
      cases: Array<{ id: string; input: { unsignedPayload?: string }; expected: { signedPayload?: string } }>;
    };
    const testCase = fixture.cases.find(({ id }) => 'symbol-transaction' === id)!;
    const unsigned = Uint8Array.from(Buffer.from(testCase.input.unsignedPayload!, 'hex'));
    const signed = Uint8Array.from(Buffer.from(testCase.expected.signedPayload!, 'hex'));
    const view = new DataView(unsigned.buffer, unsigned.byteOffset, unsigned.byteLength);

    // Transaction header: size, reserved, signature, signer, reserved, version, network, type, fee, deadline.
    expect(unsigned).toHaveLength(191);
    expect(view.getUint32(0, true)).toBe(unsigned.length);
    expect(unsigned.slice(4, 8)).toEqual(new Uint8Array(4));
    expect(unsigned.slice(8, 72)).toEqual(new Uint8Array(64));
    expect(unsigned.slice(72, 104)).toEqual(signed.slice(72, 104));
    expect(unsigned.slice(104, 108)).toEqual(new Uint8Array(4));
    expect(unsigned[108]).toBe(1);
    expect(unsigned[109]).toBe(0x68);
    expect(view.getUint16(110, true)).toBe(0x4154);
    expect(readUint64LittleEndian(unsigned, 112)).toBe(19_100n);
    expect(readUint64LittleEndian(unsigned, 120)).toBe(151_494_520_167n);

    // Transfer body: recipient, message size, mosaic count, reserved fields, mosaic and message.
    expect(unsigned.slice(128, 152)).toEqual(signed.slice(128, 152));
    expect(view.getUint16(152, true)).toBe(15);
    expect(unsigned[154]).toBe(1);
    expect(unsigned[155]).toBe(0);
    expect(unsigned.slice(156, 160)).toEqual(new Uint8Array(4));
    expect(readUint64LittleEndian(unsigned, 160)).toBe(16_666_583_871_264_174_062n);
    expect(readUint64LittleEndian(unsigned, 168)).toBe(1_300_000n);
    expect(unsigned.slice(176)).toEqual(Uint8Array.from(Buffer.from('\0Hello, Symbol!', 'utf8')));

    // A signed transaction differs from the unsigned fixture only in the 64-byte signature field.
    expect(signed).toHaveLength(unsigned.length);
    expect(signed.slice(0, 8)).toEqual(unsigned.slice(0, 8));
    expect(signed.slice(72)).toEqual(unsigned.slice(72));
  });
});
