export type ValidatorRedactionCounts = {
  emails: number;
  phoneNumbers: number;
  ssn: number;
  longNumericIds: number;
  cardLikeNumbers: number;
};

export type SanitizedValidatorText = {
  text: string;
  counts: ValidatorRedactionCounts;
  notes: string[];
};

function createCounts(): ValidatorRedactionCounts {
  return {
    emails: 0,
    phoneNumbers: 0,
    ssn: 0,
    longNumericIds: 0,
    cardLikeNumbers: 0,
  };
}

function withCounter(
  input: string,
  regex: RegExp,
  replacer: (match: string) => string,
  onCount: (count: number) => void,
) {
  let count = 0;
  const output = input.replace(regex, (match) => {
    count += 1;
    return replacer(match);
  });

  if (count > 0) {
    onCount(count);
  }

  return output;
}

function redactLongNumber(match: string) {
  const digits = match.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "[REDACTED_ID]";
  }

  return `[REDACTED_ID_***${digits.slice(-4)}]`;
}

export function sanitizeValidatorText(raw: string): SanitizedValidatorText {
  const counts = createCounts();
  let text = raw;

  text = withCounter(
    text,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    () => "[REDACTED_EMAIL]",
    (count) => {
      counts.emails += count;
    },
  );

  text = withCounter(
    text,
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
    () => "[REDACTED_PHONE]",
    (count) => {
      counts.phoneNumbers += count;
    },
  );

  text = withCounter(
    text,
    /\b\d{3}-\d{2}-\d{4}\b/g,
    () => "[REDACTED_SSN]",
    (count) => {
      counts.ssn += count;
    },
  );

  text = withCounter(
    text,
    /\b(?:\d{4}[-\s]){3}\d{1,7}\b/g,
    (match) => redactLongNumber(match),
    (count) => {
      counts.cardLikeNumbers += count;
    },
  );

  text = withCounter(
    text,
    /\b\d{9,19}\b/g,
    (match) => redactLongNumber(match),
    (count) => {
      counts.longNumericIds += count;
    },
  );

  const totalRedactions =
    counts.emails + counts.phoneNumbers + counts.ssn + counts.longNumericIds + counts.cardLikeNumbers;

  const notes: string[] = [];
  if (totalRedactions > 0) {
    notes.push(
      `Sensitive data redacted before scoring/output (emails: ${counts.emails}, phones: ${counts.phoneNumbers}, SSN: ${counts.ssn}, long IDs: ${counts.longNumericIds}, card-like numbers: ${counts.cardLikeNumbers}).`,
    );
  }

  return {
    text,
    counts,
    notes,
  };
}
