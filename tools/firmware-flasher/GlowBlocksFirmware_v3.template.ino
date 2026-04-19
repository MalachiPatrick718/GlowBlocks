// ============================================================
//  GlowBlocks Studio — Firmware v3.0
//  ATtiny1616 @ 16MHz internal
//  megaTinyCore by Spence Konde
//
//  AUTO-GENERATED COLOUR LINES — do not edit by hand; use tools/firmware-flasher
//
//  PCB PIN ASSIGNMENTS (confirmed with PCB designer)
//  UPDI  — PA0 (programming pad, not used in firmware)
//  LED   — PB1 → Arduino pin 4 on megaTinyCore
//  LEFT  — PB2 → Arduino pin 5 on megaTinyCore
//  RIGHT — PB3 → Arduino pin 6 on megaTinyCore
//
//  PROGRAMMER
//  ESP32 TX0 → 5kΩ → UPDI pad
//  ESP32 RX0 → UPDI pad (same junction)
//  ESP32 3V3 → VCC pad
//  ESP32 GND → GND pad
//
//  BEHAVIOUR
//  Deep sleep when no magnet detected (~1µA)
//  Either Hall sensor triggered → LED glows
//  Returns to sleep when both sensors clear
// ============================================================

#include <avr/sleep.h>
#include <avr/interrupt.h>
#include <Adafruit_NeoPixel.h>

#define LED_PIN        4
#define LEFT_SENSOR    5
#define RIGHT_SENSOR   6

// ── COLOUR (injected by firmware-flasher tool) ───────────────
#define COLOUR_R   __COLOUR_R__
#define COLOUR_G   __COLOUR_G__
#define COLOUR_B   __COLOUR_B__
// ─────────────────────────────────────────────────────────────

#define BRIGHTNESS   __BRIGHTNESS__
#define NUM_LEDS       1

Adafruit_NeoPixel led(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

volatile bool woken = false;

void wakeISR() {
  woken = true;
}

void goToSleep() {
  led.clear();
  led.show();
  delay(5);

  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  sei();
  sleep_cpu();
  sleep_disable();
}

void setup() {
  pinMode(LEFT_SENSOR,  INPUT);
  pinMode(RIGHT_SENSOR, INPUT);

  led.begin();
  led.setBrightness(BRIGHTNESS);
  led.clear();
  led.show();

  attachInterrupt(
    digitalPinToInterrupt(LEFT_SENSOR),
    wakeISR,
    CHANGE
  );
  attachInterrupt(
    digitalPinToInterrupt(RIGHT_SENSOR),
    wakeISR,
    CHANGE
  );

  sei();

  goToSleep();
}

void loop() {
  woken = false;

  bool leftDetected  = digitalRead(LEFT_SENSOR);
  bool rightDetected = digitalRead(RIGHT_SENSOR);

  if (leftDetected || rightDetected) {
    led.setPixelColor(0, led.Color(COLOUR_R, COLOUR_G, COLOUR_B));
    led.show();

    while (true) {
      leftDetected  = digitalRead(LEFT_SENSOR);
      rightDetected = digitalRead(RIGHT_SENSOR);

      if (!leftDetected && !rightDetected) {
        break;
      }
      delay(10);
    }

    goToSleep();

  } else {
    goToSleep();
  }
}
