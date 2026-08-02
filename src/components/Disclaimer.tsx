export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className}`}>
      Результат — это близкая интерпретация дизайна, не пиксель-в-пиксель копия. Сложные шрифты,
      точные тени и фотографии могут отличаться от оригинала.
    </p>
  );
}
