export function exportFunction(
  func: Function,
  targetScope: object,
  options?: {
    defineAs?: string;
    allowCrossOriginArguments?: boolean;
  },
): Function;
