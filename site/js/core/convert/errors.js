// Pure module: no DOM/window.
// Structural problems of an uploaded run. `code` is stable; `detail` carries data only (no prose),
// the app layer owns every user-facing (Portuguese) message.
export const ERROR_CODES = ['no_files', 'empty_file', 'missing_column', 'bad_timestamp', 'naive_timestamp',
  'no_rows', 'channel_off_grid', 'unknown_line', 'too_many_files', 'too_large', 'bad_encoding', 'read_failed',
  'no_csv', 'stations_unavailable'];

export class ConvertError extends Error {
  constructor(code, detail = {}) {
    super(code);
    this.name = 'ConvertError';
    this.code = code;
    this.detail = detail;
  }
}
