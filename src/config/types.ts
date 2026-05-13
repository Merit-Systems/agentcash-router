import type { ProtocolType } from '../types.js';

export type RouterEnv = Record<string, string | undefined>;

export type RouterConfigIssueCode =
  | 'missing_base_url'
  | 'empty_protocols'
  | 'missing_x402_accepts'
  | 'missing_x402_network'
  | 'unsupported_x402_network'
  | 'missing_x402_asset'
  | 'invalid_x402_decimals'
  | 'missing_x402_payee'
  | 'missing_cdp_keys'
  | 'placeholder_payee'
  | 'missing_mpp_config'
  | 'missing_mpp_secret_key'
  | 'missing_mpp_currency'
  | 'invalid_mpp_currency'
  | 'missing_mpp_recipient'
  | 'invalid_mpp_recipient'
  | 'missing_mpp_rpc_url'
  | 'invalid_mpp_fee_payer_key'
  | 'invalid_mpp_operator_key'
  | 'mpp_operator_equals_fee_payer'
  | 'missing_mpp_default_store_env';

export interface RouterConfigIssue {
  code: RouterConfigIssueCode;
  message: string;
  protocol?: ProtocolType;
}

export interface RouterConfigValidationOptions {
  env?: RouterEnv;
  requireCdpKeys?: boolean;
}
