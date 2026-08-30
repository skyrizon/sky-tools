import Image from "next/image";
import Link from "next/link";

const ASPECT_RATIO = 2000 / 2000;

export default function Wordmark({ height = 40 }: { height?: number }) {
  return (
    <Link href="/" className="inline-flex items-center">
      <Image
        src="/logo-lockup.svg"
        alt="Sky Tools"
        width={Math.round(height * ASPECT_RATIO)}
        height={height}
        priority
      />
    </Link>
  );
}
