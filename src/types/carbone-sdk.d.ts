declare module "carbone-sdk" {
  type CarboneRenderBody = {
    convertTo?: string;
    data: unknown;
  };

  type CarboneRenderOptions = {
    headers?: Record<string, string | number>;
  };

  type CarboneRenderResult = {
    content: Buffer;
    filename: string;
  };

  type CarboneSdk = {
    renderPromise(
      template: string,
      data: CarboneRenderBody,
      options?: CarboneRenderOptions,
    ): Promise<CarboneRenderResult>;
    setOptions(options: { carboneUrl?: string; isReturningBuffer?: boolean }): void;
  };

  function carboneSdk(apiKey: string): CarboneSdk;

  export = carboneSdk;
}
