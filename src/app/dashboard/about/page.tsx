import { BunnyImage } from '@ui/base/BunnyImage/BunnyImage';

export const metadata = {
  title: 'About',
};

export default function AboutPage() {
  return (
    <div className="section-stack">
      <header
        className="flex flex-col"
        style={{ minHeight: 'calc(var(--spacing-dashboard-content-top) - var(--spacing-dashboard-top) - 1.25rem)' }}
      >
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="page_title text-text">About</h1>
          <p className="page_subtitle mt-1 text-text-dim">The story behind this dashboard</p>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 [&>p]:text-[1.0625rem] [&>p]:md:text-[1.125rem]">
        <p className="body_text_relaxed text-text-dim leading-relaxed">
          Hi, I&apos;m Daniel. On this site you can follow every step I take. Quite literally! All data here is gathered by my Dexcom sensor, my Tandem insulin pump, and the step counter in my phone.
          So if the numbers look rough, now you know who to blame.
        </p>
        <p className="body_text_relaxed text-text-dim leading-relaxed">
          You can read more about me on{" "}
          <a
            href="https://www.danieldanielsson.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-strong underline underline-offset-4 transition-colors"
          >this site</a>.
        </p>
      </div>

      <div className="max-md:-mx-7 overflow-hidden border-border md:mx-auto md:w-full md:max-w-2xl md:rounded-lg md:border">
        <BunnyImage
          imageName="cv1.jpg"
          alt="Portrait of Daniel Danielsson"
          className="aspect-[4/3] h-full w-full object-cover"
          format="webp"
          priority
          quality={90}
          sizes="(max-width: 1023px) 100vw, 42rem"
          width={900}
        />
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-32 [&>p]:text-[1.0625rem] [&>p]:md:text-[1.125rem]">
        <h2 className="section_heading text-text-soft">Why</h2>
        <p className="body_text_relaxed text-text-dim leading-relaxed">
          I like building things. This is one of many side projects, and a way for me to explore agentic engineering as a development tool. It&apos;s something a lot of developers are still figuring out, and this is my way of learning by doing.
        </p>
        <p className="body_text_relaxed text-text-dim leading-relaxed">
          I&apos;m also a Type 1 diabetic, and for a while I&apos;ve wanted a way to summaize my data, visualize it properly, and make informed decisions about my health.
        </p>
        <p className="body_text_relaxed text-text-dim leading-relaxed">
          The core purpose of this project is really the API, which provides glucose data to multiple apps and services I&apos;m building. This dashboard app is one of these, but it also serves as a playground for testing out new features and visualizations for the API.
        </p>
      </div>
    </div>
  );
}
