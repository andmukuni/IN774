function asBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return null;
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function isObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

const UNREGISTERED = /^(unreg|unregistered|unsub|unsubscribed|inactive|not_registered|not registered|none|n\/a)$/i;

export function interpretEnquiry(body, httpStatus) {
  const status = isObject(body?.status) ? body.status : {};
  const data = isObject(body?.data) ? body.data : {};
  const registration = isObject(data.registration) ? data.registration : {};
  const successFlag = asBool(status.success);
  const firstName = clean(data.first_name);
  const lastName = clean(data.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
  const registrationStatus = clean(registration.status);
  const subscriber = {
    firstName,
    lastName,
    fullName,
    msisdn: clean(data.msisdn),
    grade: clean(data.grade),
    isBarred: asBool(data.is_barred),
    isPinSet: asBool(data.is_pin_set),
    registrationStatus,
  };
  const airtel = {
    httpStatus,
    code: clean(status.code),
    message: clean(status.message),
    resultCode: clean(status.result_code),
    success: successFlag,
  };

  if (httpStatus === 401 || httpStatus === 403) {
    return {
      verdict: 'error',
      summary: 'Airtel rejected the access token. Check the client id, client secret, and environment.',
      subscriber,
      airtel,
    };
  }

  if (!body) {
    return {
      verdict: 'error',
      summary: `Airtel returned an unreadable response (HTTP ${httpStatus}).`,
      subscriber,
      airtel,
    };
  }

  const httpOk = httpStatus >= 200 && httpStatus < 300;
  const success = successFlag === true || (successFlag == null && httpOk && Boolean(fullName || subscriber.msisdn));

  if (!success) {
    return {
      verdict: 'not_verified',
      summary: airtel.message || 'Airtel could not verify this number.',
      subscriber,
      airtel,
    };
  }

  if (subscriber.isBarred) {
    return {
      verdict: 'barred',
      summary: fullName
        ? `${fullName} is registered, and the wallet is barred.`
        : 'This number is registered, and the wallet is barred.',
      subscriber,
      airtel,
    };
  }

  if (registrationStatus && UNREGISTERED.test(registrationStatus)) {
    return {
      verdict: 'not_registered',
      summary: `Airtel returned this number with registration status ${registrationStatus}.`,
      subscriber,
      airtel,
    };
  }

  return {
    verdict: 'verified',
    summary: fullName ? `This number is registered to ${fullName}.` : 'This number is registered with Airtel.',
    subscriber,
    airtel,
  };
}
