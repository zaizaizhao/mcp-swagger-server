const URL_PATTERN = /^(http|https):\/\/[^ "]+$/;

export function isUrl(str: string): boolean {
  return URL_PATTERN.test(str);
}
