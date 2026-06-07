import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
  visible: boolean;
}

const SplashScreen = ({ onComplete, visible }: SplashScreenProps) => {
  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {/* Ocean waves background */}
          <div className="absolute inset-0 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute w-[200%] left-[-50%]"
                style={{
                  bottom: `${i * 8 - 10}%`,
                  height: "120px",
                  background: `linear-gradient(180deg, hsl(210 100% ${20 + i * 8}% / ${0.15 - i * 0.03}), transparent)`,
                  borderRadius: "50% 50% 0 0",
                }}
                animate={{
                  x: ["-5%", "5%", "-5%"],
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 3 + i * 0.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.3,
                }}
              />
            ))}
          </div>

          {/* Bubbles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`bubble-${i}`}
              className="absolute rounded-full border border-electric/20"
              style={{
                width: 6 + Math.random() * 14,
                height: 6 + Math.random() * 14,
                left: `${10 + Math.random() * 80}%`,
                bottom: "-10%",
              }}
              animate={{
                y: [0, -window.innerHeight * 1.2],
                opacity: [0, 0.6, 0],
                x: [0, (Math.random() - 0.5) * 40],
              }}
              transition={{
                duration: 2.5 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "easeOut",
              }}
            />
          ))}

          {/* Glow effects */}
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full bg-electric/5 blur-[100px]"
            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute w-[300px] h-[300px] rounded-full bg-primary/5 blur-[80px]"
            animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
          />

          {/* Shark icon */}
          <motion.div
            className="relative z-10"
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
          >
            <motion.div
              className="w-28 h-28 rounded-3xl gradient-gold flex items-center justify-center glow-gold"
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.svg
                viewBox="0 0 100 100"
                className="w-16 h-16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {/* Shark silhouette */}
                <motion.path
                  d="M15 55 Q20 40 35 38 Q45 25 55 30 Q60 28 65 32 L75 35 Q85 38 90 45 Q88 48 82 50 L78 52 Q75 55 70 56 L60 58 Q50 62 40 60 Q30 58 22 56 Z"
                  fill="hsl(220, 20%, 4%)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.4 }}
                />
                {/* Fin */}
                <motion.path
                  d="M48 38 L52 18 L58 35"
                  fill="hsl(220, 20%, 4%)"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                />
                {/* Eye */}
                <motion.circle
                  cx="72"
                  cy="42"
                  r="2.5"
                  fill="hsl(45, 90%, 55%)"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1 }}
                />
              </motion.svg>
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="relative z-10 font-display text-4xl sm:text-5xl font-bold text-primary mt-8 text-glow-gold tracking-[0.2em]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            SHARK STREAM
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="relative z-10 text-muted-foreground mt-3 font-body text-sm tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            El Océano te espera
          </motion.p>

          {/* Loading bar */}
          <motion.div
            className="relative z-10 mt-10 w-48 h-1 rounded-full bg-muted overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <motion.div
              className="h-full gradient-gold rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 1, duration: 2, ease: "easeInOut" }}
              onAnimationComplete={() => {
                // small extra delay before exit
                setTimeout(() => {
                  const event = new CustomEvent("splash-done");
                  window.dispatchEvent(event);
                }, 300);
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
