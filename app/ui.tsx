import { useState, useEffect, useRef } from "react";

export function ROw({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stats-row">
      <span className="stats-label">{label}:</span>
      <span className="stats-value">{value || "--"}</span>
    </div>
  );
}

export function BuTTon({
  primaryText,
  secondaryText,
  onClick,
  disabled = false,
  active = false,
  className = ""
}: {
  primaryText: string;
  secondaryText: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`model-viewer-button ${active ? "active" : ""} ${className}`}
    >
      <div className="button-content">
        <span className="button-primary-text">{primaryText}</span>
        <span className="button-secondary-text">{secondaryText}</span>
      </div>
    </button>
  );
}

export function HEXBtn({
  primaryText,
  secondaryText,
  onClick,
  disabled = false,
  active = false,
  className = ""
}: {
  primaryText: string;
  secondaryText: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <button 
      className={`hexagon-button ${active ? "active" : ""} ${className}`} 
      onClick={onClick} 
      disabled={disabled}
    >
      <div className="button-content">
        <span className="button-primary-text">{primaryText}</span>
        <span className="button-secondary-text">{secondaryText}</span>
      </div>
    </button>
  );
}

export function XEnoScript() {
  const hebrewChars = "אבגדהוזחטיכלמנסעפצקרשת";
  const greekChars = "αβδεζηθλμξπρφχψω";
  const cyrillicChars = "бгджзлфцэюя";
  const alienChars = hebrewChars + greekChars + cyrillicChars;
  const [chars, setChars] = useState<any[]>([]);

  useEffect(() => {
    const generatedChars = Array.from({ length: 20 }).map((_, i) => ({
      char: alienChars[Math.floor(Math.random() * alienChars.length)],
      left: Math.random() * 90 + 5,
      top: Math.random() * 90 + 5,
      opacity: 0.5 + Math.random() * 0.5,
      id: i
    }));
    setChars(generatedChars);
  }, []);

  return (
    <div className="alien-chars">
      {chars.map(({ char, left, top, opacity, id }) => (
        <div
          key={id}
          className="alien-char"
          style={{
            left: `${left}%`,
            top: `${top}%`,
            opacity
          }}
        >
          {char}
        </div>
      ))}
    </div>
  );
}

export function HEXAgrid() {
  const [activeHexagons, setActiveHexagons] = useState([true, false, true, false, true]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setActiveHexagons((prev) => {
        const newActiveHexagons = [...prev];
        const randomIndex = Math.floor(Math.random() * newActiveHexagons.length);
        newActiveHexagons[randomIndex] = !newActiveHexagons[randomIndex];
        return newActiveHexagons;
      });
    }, 2000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="hexagrid">
      {activeHexagons.map((isActive, index) => (
        <div key={index} className={`hexagon ${isActive ? "active" : ""}`} />
      ))}
    </div>
  );
}

export function ScrollTXsT({ text, width = 200 }: { text: string, width?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const textElement = textRef.current;
    if (!container || !textElement) return;

    const ROUNDING_BUFFER = 2;
    const textWidth = textElement.scrollWidth - 10;
    const containerWidth = container.clientWidth;
    const hasOverflow = textWidth > containerWidth + ROUNDING_BUFFER;

    if (!hasOverflow) {
      textElement.style.transform = "translateX(0)";
      return;
    }

    const totalScrollDistance = textWidth - containerWidth + 10;
    const stepSize = 4;
    const stepDelay = 200;
    const pauseDuration = 2000;

    let position = 0;
    let direction = -1;
    let isPaused = true;
    let pauseTimer: NodeJS.Timeout;
    let animationTimer: NodeJS.Timeout;

    const updatePosition = () => {
      if (isPaused) {
        pauseTimer = setTimeout(() => {
          isPaused = false;
          updatePosition();
        }, pauseDuration);
        return;
      }

      position += direction * stepSize;

      if (direction === -1 && position <= -totalScrollDistance) {
        position = -totalScrollDistance;
        isPaused = true;
        direction = 1;
      } else if (direction === 1 && position >= 0) {
        position = 0;
        isPaused = true;
        direction = -1;
      }

      textElement.style.transform = `translateX(${position}px)`;
      animationTimer = setTimeout(updatePosition, stepDelay);
    };

    updatePosition();

    return () => {
      clearTimeout(animationTimer);
      clearTimeout(pauseTimer);
    };
  }, [text]);

  return (
    <div ref={containerRef} style={{ width: `${width}px`, overflow: "hidden" }}>
      <span ref={textRef} style={{ whiteSpace: "nowrap", display: "inline-block" }}>
        {text}
      </span>
    </div>
  );
}
