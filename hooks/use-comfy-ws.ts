"use client";
import { useEffect, useRef } from "react";

const LOG = (...args: unknown[]) =>
  console.log("[ComfyWS]", ...args);

function detectImageFormat(
  buffer: ArrayBuffer,
  offset: number,
): { mimeType: string; valid: boolean } {
  if (buffer.byteLength <= offset + 2)
    return { mimeType: "image/jpeg", valid: false };
  const view = new Uint8Array(
    buffer,
    offset,
    Math.min(4, buffer.byteLength - offset),
  );
  // JPEG: FF D8 FF
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff)
    return { mimeType: "image/jpeg", valid: true };
  // PNG: 89 50 4E 47
  if (
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47
  )
    return { mimeType: "image/png", valid: true };
  return { mimeType: "image/jpeg", valid: false };
}

// image_type field: 1=JPEG, 2=PNG (ComfyUI Cloud spec)
function mimeFromImageType(imageType: number): string {
  return imageType === 2 ? "image/png" : "image/jpeg";
}

export function useComfyWS(
  clientId: string,
  handlers: {
    onProgress?: (value: number, max: number, promptId: string) => void;
    onPreview?: (imageUrl: string) => void;
    onSuccess?: (promptId: string) => void;
    onError?: (promptId: string, message: string) => void;
    onStatusChange?: (connected: boolean) => void;
  },
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const prevPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const comfyUrl =
      process.env.NEXT_PUBLIC_COMFYUI_URL || "http://localhost:8188";
    const apiKey = process.env.NEXT_PUBLIC_COMFYUI_API_KEY;
    const wsBase = comfyUrl.replace(/^http/, "ws");
    const wsUrl = apiKey
      ? `${wsBase}/ws?clientId=${clientId}&token=${apiKey}`
      : `${wsBase}/ws?clientId=${clientId}`;

    LOG("Scheduling connect to", wsUrl.replace(/token=[^&]+/, "token=***"));

    let ws: WebSocket;
    let connectTimer: ReturnType<typeof setTimeout>;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let destroyed = false;

    function revokePreview() {
      if (prevPreviewUrlRef.current) {
        URL.revokeObjectURL(prevPreviewUrlRef.current);
        prevPreviewUrlRef.current = null;
      }
    }

    function setPreview(imageBytes: ArrayBuffer, mimeType: string) {
      revokePreview();
      const blob = new Blob([imageBytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      prevPreviewUrlRef.current = url;
      LOG(`Preview updated: ${mimeType}, ${imageBytes.byteLength} bytes`);
      handlersRef.current.onPreview?.(url);
    }

    function handleBinary(buffer: ArrayBuffer) {
      if (buffer.byteLength < 8) {
        LOG("Binary too short:", buffer.byteLength);
        return;
      }

      const view = new DataView(buffer);
      const eventType = view.getUint32(0);
      const imageTypeField = view.getUint32(4);

      LOG(`Binary frame: eventType=${eventType}, imageTypeField=${imageTypeField}, size=${buffer.byteLength}`);

      // type 1 = PREVIEW_IMAGE, type 4 = PREVIEW_IMAGE_WITH_METADATA
      // Both have layout: [type(4)][image_type(4)][image_data...]
      if (eventType !== 1 && eventType !== 4) {
        LOG("Ignoring binary frame with eventType:", eventType);
        return;
      }

      const mimeFromHeader = mimeFromImageType(imageTypeField);

      // Check magic bytes at offset 8
      const { valid: validAt8, mimeType: mimeAt8 } = detectImageFormat(buffer, 8);
      if (validAt8) {
        LOG(`Magic bytes match at offset 8: ${mimeAt8}`);
        setPreview(buffer.slice(8), mimeAt8);
        return;
      }

      // Fallback: some versions omit the image_type field
      const { valid: validAt4, mimeType: mimeAt4 } = detectImageFormat(buffer, 4);
      if (validAt4) {
        LOG(`Magic bytes match at offset 4 (no imageType header): ${mimeAt4}`);
        setPreview(buffer.slice(4), mimeAt4);
        return;
      }

      // Last resort: trust header-declared format
      LOG(`No magic bytes found, using header-declared format: ${mimeFromHeader}`);
      if (buffer.byteLength > 8) {
        setPreview(buffer.slice(8), mimeFromHeader);
      }
    }

    function connect() {
      try {
        ws = new WebSocket(wsUrl);
      } catch (err) {
        LOG("WebSocket constructor failed:", err);
        handlersRef.current.onStatusChange?.(false);
        if (!destroyed) reconnectTimer = setTimeout(connect, 5000);
        return;
      }

      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        LOG("Connected");
        handlersRef.current.onStatusChange?.(true);
      };

      ws.onmessage = (event) => {
        // Binary: preview image
        if (event.data instanceof ArrayBuffer) {
          handleBinary(event.data);
          return;
        }

        // Blob fallback (in case binaryType is ignored)
        if (event.data instanceof Blob) {
          LOG("Received Blob (binaryType fallback), converting...");
          event.data.arrayBuffer().then(handleBinary);
          return;
        }

        // Text JSON messages
        try {
          const msg = JSON.parse(event.data as string);
          LOG("JSON message:", msg.type, msg.data ?? "");

          switch (msg.type) {
            case "status":
              LOG("Queue remaining:", msg.data?.status?.exec_info?.queue_remaining);
              break;
            case "execution_start":
              LOG("Execution started, prompt_id:", msg.data?.prompt_id);
              break;
            case "executing":
              LOG("Executing node:", msg.data?.node ?? "(null = complete)", "prompt_id:", msg.data?.prompt_id);
              break;
            case "progress":
              LOG(`Progress: ${msg.data.value}/${msg.data.max} prompt_id=${msg.data.prompt_id}`);
              handlersRef.current.onProgress?.(
                msg.data.value,
                msg.data.max,
                msg.data.prompt_id,
              );
              break;
            case "executed":
              LOG("Node executed, node:", msg.data?.node, "output keys:", Object.keys(msg.data?.output ?? {}));
              break;
            case "execution_cached":
              LOG("Cached nodes:", msg.data?.nodes);
              break;
            case "execution_success":
              LOG("Execution success, prompt_id:", msg.data?.prompt_id);
              handlersRef.current.onSuccess?.(msg.data.prompt_id);
              break;
            case "execution_error":
              LOG("Execution error:", msg.data?.exception_message, msg.data?.traceback);
              handlersRef.current.onError?.(
                msg.data.prompt_id,
                msg.data.exception_message || "Unknown error",
              );
              break;
            case "execution_interrupted":
              LOG("Execution interrupted, prompt_id:", msg.data?.prompt_id);
              handlersRef.current.onError?.(
                msg.data?.prompt_id ?? "",
                "Execution interrupted",
              );
              break;
            default:
              LOG("Unhandled message type:", msg.type);
          }
        } catch {
          LOG("Failed to parse JSON:", event.data);
        }
      };

      ws.onclose = (event) => {
        LOG(`Closed: code=${event.code} reason=${event.reason}`);
        handlersRef.current.onStatusChange?.(false);
        if (!destroyed) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        LOG("Error:", err);
        handlersRef.current.onStatusChange?.(false);
      };
    }

    // Defer connect by one tick so React StrictMode's immediate cleanup can
    // cancel this timer before the socket is even created, avoiding the
    // "closed before connection established" warning.
    connectTimer = setTimeout(connect, 0);

    return () => {
      destroyed = true;
      clearTimeout(connectTimer);
      clearTimeout(reconnectTimer);
      LOG("Cleanup: closing WebSocket");
      ws?.close();
      revokePreview();
    };
  }, [clientId]);
}
