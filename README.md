# 🃏 MSN 7 Hand Poker Remake

A self-hosted, real-time multiplayer remake of the classic **7 Hand Poker** (also known as *7 Card Showdown*) game from the golden era of MSN Messenger. 

This project is built using a modern, lightweight, mobile-first tech stack optimized for seamless gameplay on Android and iOS devices over your home local network (LAN).

---

## 🎮 How to Play

Unlike standard Texas Hold 'Em, this is a tactical grid-building poker game where you play **seven hands at the same time** against an opponent.

1. **The Grid:** Both players start with an empty board of **7 hand columns** (each column holds up to 5 cards).
2. **The Turn:** Players take turns drawing a card from their own shuffled 52-card deck.
3. **Card Placement:** On your turn, you must place your current card into one of your 7 columns.
   * *The MSN Rule:* You must place one card in each of your 7 columns (completing Row 1) before you can start placing cards into Row 2.
4. **Hidden Information:** The **first card** you place in each column is visible to your opponent. Cards 2 through 5 are **hidden (face-down)** until both players fill that specific column, or the game ends.
5. **Winning:** Once both players have filled all 7 columns (35 cards placed each), the hands are evaluated using standard poker hand rankings. Whoever wins at least **4 out of the 7 columns** wins the match!

---

## 🚀 Quick Start (Docker Deployment)

Deploy this instantly on your local Ubuntu server (or any Docker-enabled machine) using the lightweight alpine container.

### 1. Clone & Build
```bash
# Clone your repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

# Build the Docker image
docker build -t msn-7hand-poker .
