import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Даты ККТ из ОФД (конец ФН, конец договора) заданы по московскому времени,
// например 30.10 23:59:59 МСК. В часовом поясе браузера (Новосибирск, Омск…)
// это уже следующий день — поэтому дату показываем по Москве.
export const OFD_TZ = 'Europe/Moscow';

export const ofdDate = (iso) => dayjs(iso).tz(OFD_TZ);

export const fmtOfdDate = (iso) =>
  iso && dayjs(iso).isValid() ? ofdDate(iso).format('DD.MM.YYYY') : '—';
