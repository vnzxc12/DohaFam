import os
import math
import numpy as np
import scipy.io.wavfile as wavfile
import subprocess

SR = 44100

def note_freq(name):
    # e.g., C4, D#4, Bb3
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    flat_map = {'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#'}
    if len(name) >= 2 and name[:2] in flat_map:
        name = flat_map[name[:2]] + name[2:]
    
    if name[1] == '#':
        pitch = name[:2]
        octave = int(name[2:])
    else:
        pitch = name[0]
        octave = int(name[1:])
    
    semitone = notes.index(pitch)
    # A4 = 440 Hz is octave 4, semitone 9
    midi = (octave + 1) * 12 + semitone
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))

def make_tine_bell(freq, duration, velocity=0.8):
    # Music box / Celesta tine synthesis
    t = np.linspace(0, duration, int(SR * duration), False)
    
    # Metal tine harmonics
    h1 = np.sin(2 * np.pi * freq * t) * np.exp(-t * 2.8)
    h2 = 0.45 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 6.5)
    h3 = 0.20 * np.sin(2 * np.pi * freq * 5.40 * t) * np.exp(-t * 11.0)
    h4 = 0.08 * np.sin(2 * np.pi * freq * 8.93 * t) * np.exp(-t * 18.0)
    
    # Soft hammer impulse click
    click = np.random.normal(0, 0.04, len(t)) * np.exp(-t * 120.0)
    
    signal = (h1 + h2 + h3 + h4 + click) * velocity
    # Quick attack ramp to avoid pop
    attack_samples = int(SR * 0.004)
    if len(signal) > attack_samples:
        signal[:attack_samples] *= np.linspace(0, 1, attack_samples)
    return signal

def make_warm_piano(freq, duration, velocity=0.6):
    t = np.linspace(0, duration, int(SR * duration), False)
    # Warm piano: fundamental + warm even & odd harmonics
    f1 = 1.0 * np.sin(2 * np.pi * freq * t) * np.exp(-t * 1.6)
    f2 = 0.5 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 2.4)
    f3 = 0.25 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 3.5)
    f4 = 0.10 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 5.0)
    
    signal = (f1 + f2 + f3 + f4) * velocity
    attack = int(SR * 0.008)
    if len(signal) > attack:
        signal[:attack] *= np.linspace(0, 1, attack)
    return signal

def make_warm_bass(freq, duration, velocity=0.45):
    t = np.linspace(0, duration, int(SR * duration), False)
    b1 = 1.0 * np.sin(2 * np.pi * freq * t) * np.exp(-t * 0.8)
    b2 = 0.3 * np.sin(2 * np.pi * freq * 2 * t) * np.exp(-t * 1.4)
    b3 = 0.1 * np.sin(2 * np.pi * freq * 3 * t) * np.exp(-t * 2.2)
    signal = (b1 + b2 + b3) * velocity
    attack = int(SR * 0.02)
    if len(signal) > attack:
        signal[:attack] *= np.linspace(0, 1, attack)
    return signal

# -------------------------------------------------------------
# Arrangement: Key of C Major, 3/4 time, BPM = 68
# Beat duration = 60 / 68 = 0.88235 seconds
# Measure duration = 3 * beat_dur = 2.647 seconds
# Total 24 measures = ~63.5 seconds
# -------------------------------------------------------------
BPM = 68.0
BEAT = 60.0 / BPM
MEASURE = BEAT * 3.0

melody_notes = [
    # M1: G4 (1.5), A4 (0.5), G4 (1.0)
    (0.0 * BEAT, 'G4', 1.5, 0.85),
    (1.5 * BEAT, 'A4', 0.5, 0.70),
    (2.0 * BEAT, 'G4', 1.0, 0.75),
    # M2: E4 (3.0)
    (3.0 * BEAT, 'E4', 3.0, 0.80),
    
    # M3: G4 (1.5), A4 (0.5), G4 (1.0)
    (6.0 * BEAT, 'G4', 1.5, 0.85),
    (7.5 * BEAT, 'A4', 0.5, 0.70),
    (8.0 * BEAT, 'G4', 1.0, 0.75),
    # M4: E4 (3.0)
    (9.0 * BEAT, 'E4', 3.0, 0.80),
    
    # M5: D5 (2.0), D5 (1.0)
    (12.0 * BEAT, 'D5', 2.0, 0.90),
    (14.0 * BEAT, 'D5', 1.0, 0.75),
    # M6: B4 (3.0)
    (15.0 * BEAT, 'B4', 3.0, 0.85),
    
    # M7: C5 (2.0), C5 (1.0)
    (18.0 * BEAT, 'C5', 2.0, 0.90),
    (20.0 * BEAT, 'C5', 1.0, 0.75),
    # M8: G4 (3.0)
    (21.0 * BEAT, 'G4', 3.0, 0.85),
    
    # M9: A4 (2.0), A4 (1.0)
    (24.0 * BEAT, 'A4', 2.0, 0.85),
    (26.0 * BEAT, 'A4', 1.0, 0.75),
    # M10: C5 (1.5), B4 (0.5), A4 (1.0)
    (27.0 * BEAT, 'C5', 1.5, 0.90),
    (28.5 * BEAT, 'B4', 0.5, 0.75),
    (29.0 * BEAT, 'A4', 1.0, 0.80),
    
    # M11: G4 (1.5), A4 (0.5), G4 (1.0)
    (30.0 * BEAT, 'G4', 1.5, 0.85),
    (31.5 * BEAT, 'A4', 0.5, 0.70),
    (32.0 * BEAT, 'G4', 1.0, 0.75),
    # M12: E4 (3.0)
    (33.0 * BEAT, 'E4', 3.0, 0.80),
    
    # M13: A4 (2.0), A4 (1.0)
    (36.0 * BEAT, 'A4', 2.0, 0.85),
    (38.0 * BEAT, 'A4', 1.0, 0.75),
    # M14: C5 (1.5), B4 (0.5), A4 (1.0)
    (39.0 * BEAT, 'C5', 1.5, 0.90),
    (40.5 * BEAT, 'B4', 0.5, 0.75),
    (41.0 * BEAT, 'A4', 1.0, 0.80),
    
    # M15: G4 (1.5), A4 (0.5), G4 (1.0)
    (42.0 * BEAT, 'G4', 1.5, 0.85),
    (43.5 * BEAT, 'A4', 0.5, 0.70),
    (44.0 * BEAT, 'G4', 1.0, 0.75),
    # M16: E4 (3.0)
    (45.0 * BEAT, 'E4', 3.0, 0.80),
    
    # M17: D5 (2.0), D5 (1.0)
    (48.0 * BEAT, 'D5', 2.0, 0.90),
    (50.0 * BEAT, 'D5', 1.0, 0.75),
    # M18: F5 (1.5), D5 (0.5), B4 (1.0)
    (51.0 * BEAT, 'F5', 1.5, 0.95),
    (52.5 * BEAT, 'D5', 0.5, 0.80),
    (53.0 * BEAT, 'B4', 1.0, 0.85),
    
    # M19: C5 (3.0)
    (54.0 * BEAT, 'C5', 3.0, 0.90),
    # M20: E5 (3.0)
    (57.0 * BEAT, 'E5', 3.0, 0.95),
    
    # M21: C5 (1.5), G4 (0.5), E4 (1.0)
    (60.0 * BEAT, 'C5', 1.5, 0.85),
    (61.5 * BEAT, 'G4', 0.5, 0.70),
    (62.0 * BEAT, 'E4', 1.0, 0.75),
    
    # M22: G4 (1.5), F4 (0.5), D4 (1.0)
    (63.0 * BEAT, 'G4', 1.5, 0.85),
    (64.5 * BEAT, 'F4', 0.5, 0.70),
    (65.0 * BEAT, 'D4', 1.0, 0.75),
    
    # M23: C4 (3.0)
    (66.0 * BEAT, 'C4', 3.0, 0.85),
    # M24: Gentle C5 sparkle ring (3.0)
    (69.0 * BEAT, 'C5', 3.0, 0.65)
]

# Harmony accompaniment patterns for each measure (Root, 3rd, 5th, octave arpeggios)
chords_per_measure = [
    # M1 - M4: C major
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    # M5 - M6: G7
    ['G2', 'D3', 'B3', 'F4'],
    ['G2', 'D3', 'B3', 'F4'],
    # M7 - M8: C major
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    # M9 - M10: F major
    ['F2', 'C3', 'A3', 'C4'],
    ['F2', 'C3', 'A3', 'C4'],
    # M11 - M12: C major
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    # M13 - M14: F major
    ['F2', 'C3', 'A3', 'C4'],
    ['F2', 'C3', 'A3', 'C4'],
    # M15 - M16: C major
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'E4'],
    # M17 - M18: G7
    ['G2', 'D3', 'B3', 'F4'],
    ['G2', 'D3', 'B3', 'F4'],
    # M19 - M20: C major & C7/Am
    ['C3', 'G3', 'C4', 'E4'],
    ['C3', 'G3', 'C4', 'G4'],
    # M21 - M22: C & G7
    ['C3', 'G3', 'C4', 'E4'],
    ['G2', 'D3', 'B3', 'F4'],
    # M23 - M24: C major resolving
    ['C3', 'G3', 'C4', 'E4'],
    ['C2', 'G2', 'C3', 'G3']
]

total_beats = 24 * 3 # 72 beats
total_duration = total_beats * BEAT + 3.0 # extra tail for ring
total_samples = int(SR * total_duration)

left = np.zeros(total_samples, dtype=np.float32)
right = np.zeros(total_samples, dtype=np.float32)

def add_audio(target_l, target_r, signal, start_sec, pan=0.0):
    start_idx = int(start_sec * SR)
    end_idx = min(start_idx + len(signal), len(target_l))
    sig_len = end_idx - start_idx
    if sig_len <= 0:
        return
    
    # Pan: -1.0 is full left, +1.0 is full right
    pan_angle = (pan + 1.0) * (np.pi / 4.0)
    vol_l = np.cos(pan_angle)
    vol_r = np.sin(pan_angle)
    
    target_l[start_idx:end_idx] += signal[:sig_len] * vol_l
    target_r[start_idx:end_idx] += signal[:sig_len] * vol_r

print("Rendering Silent Night...")

# 1. Render Melody (Lead Music Box / Celesta Tine Bell)
for start_t, note, dur_beats, vel in melody_notes:
    freq = note_freq(note)
    dur_sec = dur_beats * BEAT + 1.2
    
    # Primary music box tine (center-left)
    tine = make_tine_bell(freq, dur_sec, velocity=vel * 0.70)
    add_audio(left, right, tine, start_t, pan=-0.15)
    
    # Octave overtone sparkle bell (center-right, softer)
    freq_high = freq * 2.0
    sparkle = make_tine_bell(freq_high, dur_sec * 0.7, velocity=vel * 0.28)
    add_audio(left, right, sparkle, start_t, pan=0.25)
    
    # Soft warm piano doubling on key melody notes
    piano_mel = make_warm_piano(freq, dur_sec, velocity=vel * 0.40)
    add_audio(left, right, piano_mel, start_t, pan=0.05)

# 2. Render Harmony Arpeggios & Warm Bass
for m_idx, chord in enumerate(chords_per_measure):
    m_start = m_idx * MEASURE
    root_bass = chord[0]
    
    # Warm deep bass note on beat 1 of measure
    bass_freq = note_freq(root_bass)
    bass_snd = make_warm_bass(bass_freq, MEASURE * 1.2, velocity=0.45)
    add_audio(left, right, bass_snd, m_start, pan=0.0)
    
    # 3-beat gentle rolling acoustic arpeggios
    # Beat 1: root
    p1 = make_warm_piano(note_freq(chord[0]), BEAT * 2.0, velocity=0.30)
    add_audio(left, right, p1, m_start, pan=-0.25)
    
    # Beat 2: 5th & 3rd
    p2 = make_warm_piano(note_freq(chord[1]), BEAT * 1.8, velocity=0.25)
    add_audio(left, right, p2, m_start + BEAT, pan=0.20)
    
    # Beat 3: high octave
    p3 = make_warm_piano(note_freq(chord[2]), BEAT * 1.8, velocity=0.26)
    add_audio(left, right, p3, m_start + 2.0 * BEAT, pan=-0.10)
    
    # Soft celestial bell chime on beat 2.5 of selected measures
    if m_idx % 2 == 1:
        bell_bg = make_tine_bell(note_freq(chord[3]), BEAT * 1.5, velocity=0.18)
        add_audio(left, right, bell_bg, m_start + 1.5 * BEAT, pan=0.35)

# 3. Stereo Hall Reverb & Warm Chorus Simulation
def apply_warm_stereo_reverb(l_chan, r_chan):
    # Multi-tap feedback delay network
    delays_l = [int(SR * 0.043), int(SR * 0.089), int(SR * 0.167), int(SR * 0.312)]
    delays_r = [int(SR * 0.051), int(SR * 0.097), int(SR * 0.181), int(SR * 0.334)]
    decay = [0.38, 0.28, 0.18, 0.10]
    
    rev_l = np.zeros_like(l_chan)
    rev_r = np.zeros_like(r_chan)
    
    for d, w in zip(delays_l, decay):
        rev_l[d:] += l_chan[:-d] * w
    for d, w in zip(delays_r, decay):
        rev_r[d:] += r_chan[:-d] * w
        
    return l_chan + rev_l * 0.65, r_chan + rev_r * 0.65

left, right = apply_warm_stereo_reverb(left, right)

# 4. Master volume normalization & soft limiter
max_val = max(np.max(np.abs(left)), np.max(np.abs(right)))
if max_val > 0:
    left = (left / max_val) * 0.88
    right = (right / max_val) * 0.88

# Fade in (first 1.5 sec) and fade out (last 2.5 sec) for beautiful seamless looping
fade_in_len = int(SR * 1.2)
fade_out_len = int(SR * 2.5)

left[:fade_in_len] *= np.linspace(0, 1, fade_in_len)
right[:fade_in_len] *= np.linspace(0, 1, fade_in_len)

left[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)
right[-fade_out_len:] *= np.linspace(1, 0, fade_out_len)

# Interleave stereo 16-bit PCM
stereo = np.column_stack((left, right))
stereo_int16 = (stereo * 32767.0).astype(np.int16)

os.makedirs('D:/Remotion/channels/doha-fam-wishlist/public/audio', exist_ok=True)
wav_path = 'D:/Remotion/channels/doha-fam-wishlist/public/audio/silent_night.wav'
mp3_path = 'D:/Remotion/channels/doha-fam-wishlist/public/audio/silent_night.mp3'

wavfile.write(wav_path, SR, stereo_int16)
print(f"WAV saved: {wav_path} ({len(left)/SR:.2f} seconds)")

# Convert to 192k MP3 via ffmpeg
subprocess.run(['ffmpeg', '-y', '-i', wav_path, '-b:a', '192k', mp3_path], check=True)
print(f"MP3 saved: {mp3_path}")

