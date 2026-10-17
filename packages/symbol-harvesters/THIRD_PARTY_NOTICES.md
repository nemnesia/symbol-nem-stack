# 外部資料とテストデータ

`test/fixtures/shoestring-harvesters.dat` は Symbol Contributors による Shoestring の公開テストデータです。

- 出典: https://github.com/symbol/product/blob/9a3f1bf92ff6009b364bda6107af0ccfca9b08ce/tools/shoestring/tests/resources/harvesters.dat
- 期待する Testnet アドレスとテスト専用復号鍵: 同コミットの `tools/shoestring/tests/commands/test_import_harvesters.py`
- ライセンス宣言: 同コミットの `tools/shoestring/pyproject.toml` (`license = 'MIT'`)
- 帰属: Symbol Contributors

fixture とその復号鍵はテスト用途で公開されたものです。実運用には使用しないでください。fixture は npm 配布物には含めません。

MIT License

Copyright Symbol Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
