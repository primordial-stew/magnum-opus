import { SAXParser } from "https://unpkg.com/sax-ts@1.2.12/src/sax.ts";

export class TmxSegmentStream extends TransformStream {
  // @ts-ignore: ignoring the "no initializer" error since the constructor calls `#reset`
  #segments: Array<string>;
  // @ts-ignore: ignoring the "no initializer" error since the constructor calls `#reset`
  #index: number;
  // @ts-ignore: ignoring the "no initializer" error since the constructor calls `#reset`
  #capture: boolean;

  constructor() {
    const parser = new SAXParser(false, {});

    super({
      start: (controller) => {
        parser.onopentag = ({ name }: { name: string }) => {
          switch (name) {
            case "TU":
              this.#reset();
              break;
            case "SEG":
              this.#capture = true;
              break;
          }
        };

        parser.onclosetag = (name: string) => {
          switch (name) {
            case "TU":
              controller.enqueue(this.#segments);
              break;
            case "SEG":
              this.#index++;
              break;
          }
        };

        parser.ontext = (text: string) => {
          if (this.#capture) {
            this.#segments[this.#index] = text;
            this.#capture = false;
          }
        };
      },

      transform: (chunk) => {
        parser.write(chunk);
      },
    });

    this.#reset();
  }

  #reset() {
    this.#segments = [];
    this.#index = 0;
    this.#capture = false;
  }
}
