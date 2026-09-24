declare module "mammoth" {
  export interface RawTextResult {
    value: string;
    messages: any[];
  }
  export function extractRawText(input: {
    arrayBuffer?: ArrayBuffer;
    path?: string;
    buffer?: any;
  }): Promise<RawTextResult>;
}
