import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";
import { cache } from "../utils/cacheRedis";
import { asyncHandler } from "./asyncHandler";

/**
 * Антиспам middleware для создания сообщений.
 *
 * Защита работает на трёх уровнях:
 * 1. Burst — минимум 30 секунд между сообщениями с одного IP
 * 2. IP + Fingerprint — 3 сообщения в день с одной комбинации IP+fingerprint
 * 3. Fingerprint — 5 сообщений в день с одного fingerprint (даже при смене IP/VPN)
 *
 * Fingerprint генерируется на клиенте из параметров браузера и передаётся
 * в заголовке X-Fingerprint. Без fingerprint работают только IP-лимиты.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const BURST_MS = 30 * 1000; // 30 секунд между сообщениями

const LIMIT_PER_IP_FP = 3; // Лимит на комбинацию IP + fingerprint в день
const LIMIT_PER_FP = 5;    // Лимит на fingerprint в день (защита от VPN)
const LIMIT_PER_IP = 3;    // Лимит на IP в день (если нет fingerprint)

export const antispamCheck = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const fingerprint = req.headers["x-fingerprint"];
    const fp = typeof fingerprint === "string" && fingerprint.length >= 16
      ? fingerprint
      : null;

    // 1. Burst protection — минимум 30 секунд между сообщениями с одного IP
    const burstKey = `antispam:burst:${ip}`;
    const lastSent = await cache.get<number>(burstKey);
    if (lastSent) {
      const elapsed = Date.now() - lastSent;
      if (elapsed < BURST_MS) {
        const waitSec = Math.ceil((BURST_MS - elapsed) / 1000);
        throw new AppError(
          `Please wait ${waitSec} seconds before sending another message.`,
          429,
          "TOO_MANY_REQUESTS",
        );
      }
    }

    // 2. IP + Fingerprint лимит (основная защита)
    if (fp) {
      const ipFpKey = `antispam:ipfp:${ip}:${fp}`;
      const ipFpCount = (await cache.get<number>(ipFpKey)) || 0;
      if (ipFpCount >= LIMIT_PER_IP_FP) {
        throw new AppError(
          "Daily message limit exceeded. Try again tomorrow.",
          429,
          "TOO_MANY_REQUESTS",
        );
      }

      // 3. Fingerprint-only лимит (защита от VPN/прокси)
      const fpKey = `antispam:fp:${fp}`;
      const fpCount = (await cache.get<number>(fpKey)) || 0;
      if (fpCount >= LIMIT_PER_FP) {
        throw new AppError(
          "Daily message limit exceeded. Try again tomorrow.",
          429,
          "TOO_MANY_REQUESTS",
        );
      }

      // Инкрементируем счётчики
      await cache.set(ipFpKey, ipFpCount + 1, DAY_MS);
      await cache.set(fpKey, fpCount + 1, DAY_MS);
    } else {
      // Нет fingerprint — fallback на IP-only лимит
      const ipKey = `antispam:ip:${ip}`;
      const ipCount = (await cache.get<number>(ipKey)) || 0;
      if (ipCount >= LIMIT_PER_IP) {
        throw new AppError(
          "Daily message limit exceeded. Try again tomorrow.",
          429,
          "TOO_MANY_REQUESTS",
        );
      }
      await cache.set(ipKey, ipCount + 1, DAY_MS);
    }

    // Устанавливаем burst timestamp
    await cache.set(burstKey, Date.now(), BURST_MS);

    next();
  },
);
