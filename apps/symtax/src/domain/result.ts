export type Completeness = 'complete' | 'partial' | 'incomplete' | 'unsupported';
export type InformationState =
  'complete' | 'partial' | 'incomplete' | 'unavailable' | 'unsupported' | 'invalid' | 'unknown';

export type SymTaxErrorCode =
  | 'invalid-input'
  | 'unsupported-input'
  | 'wrong-network'
  | 'network-identity-unavailable'
  | 'unsupported-network'
  | 'invalid-continuation'
  | 'future-period'
  | 'internal-failure';

export interface DomainError {
  readonly code: SymTaxErrorCode;
  readonly retryable: boolean;
}

export type Result<T, E extends DomainError = DomainError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): Result<T> => ({ ok: true, value });

export const failure = <E extends DomainError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export function publicErrorMessage(error: DomainError): string {
  switch (error.code) {
    case 'wrong-network':
      return '入力したアドレスが、この環境のネットワークと一致しません。';
    case 'network-identity-unavailable':
      return 'ネットワークを確認できないため、処理を停止しました。';
    case 'unsupported-network':
      return 'このネットワークは対象外です。';
    case 'invalid-continuation':
      return 'ページ継続情報が無効です。最初のページから再開してください。';
    case 'future-period':
      return '指定期間を確認してください。';
    case 'unsupported-input':
      return 'この形式の入力には対応していません。';
    case 'invalid-input':
      return '入力内容を確認してください。';
    case 'internal-failure':
      return '処理を完了できませんでした。';
  }
}
