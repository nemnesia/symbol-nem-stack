/** 入力値や外部の例外原文を含まない、CLIに表示可能な診断です。 */
export class DiagnosticError extends Error {}

/** ファイルシステムの例外から既知のコードだけを取り出します。パスは表示しません。 */
export function fileErrorDetail(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('code' in error)) return undefined;
  switch (error.code) {
    case 'ENOENT':
      return 'ファイルまたは親ディレクトリが存在しません（ENOENT）。';
    case 'EACCES':
    case 'EPERM':
      return 'アクセス権がありません（EACCES / EPERM）。';
    case 'EEXIST':
      return 'ファイルが既に存在します（EEXIST）。既存ファイルは上書きしません。';
    case 'EISDIR':
      return 'ファイルの代わりにディレクトリが指定されています（EISDIR）。';
    case 'ENOTDIR':
      return 'パスの途中にディレクトリではない項目があります（ENOTDIR）。';
    case 'ENOSPC':
      return '保存先の空き容量が不足しています（ENOSPC）。';
    case 'EROFS':
      return '保存先は読み取り専用です（EROFS）。';
    default:
      return undefined;
  }
}
