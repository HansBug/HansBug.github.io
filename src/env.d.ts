/// <reference types="astro/client" />

declare module "@citation-js/core" {
  export class Cite {
    constructor(input: string);
    data: Array<{ id?: string; "citation-key"?: string }>;
  }
}
