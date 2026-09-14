package main

import (
	"fmt"
	"log"
	"math/rand"
	"net"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"
)

type ScrcpyProcess struct {
	config           *AgentConfig
	cmd              *exec.Cmd
	videoConn        net.Conn
	audioConn        net.Conn
	controlConn      net.Conn
	control          *ControlWriter
	currentOptions   ScrcpyOptions
	mu               sync.Mutex
	startMu          sync.Mutex
	handshakeTimeout time.Duration

	// Cached listener network and addresses for inspection or mock testing
	listenerNet string
	videoAddr   string
	audioAddr   string
	ctrlAddr    string

	// Optional hook triggered as soon as listeners are bound and ready for connections
	onListening func()
}

func NewScrcpyProcess(cfg *AgentConfig) *ScrcpyProcess {
	defaultOpts := ScrcpyOptions{
		VideoSource:  "display",
		MaxSize:      cfg.MaxSize,
		VideoBitRate: cfg.Bitrate,
		MaxFPS:       cfg.MaxFPS,
		StayAwake:    false,
	}
	if cfg.Audio {
		aud := true
		defaultOpts.Audio = &aud
	}
	return &ScrcpyProcess{
		config:         cfg,
		currentOptions: defaultOpts,
	}
}

func (sp *ScrcpyProcess) buildArgs(opts ScrcpyOptions, scid int32, port int) []string {
	bitrate := sp.config.Bitrate
	if opts.VideoBitRate > 0 {
		bitrate = opts.VideoBitRate
	} else if opts.Bitrate > 0 {
		bitrate = opts.Bitrate
	}

	maxFPS := sp.config.MaxFPS
	if opts.MaxFPS > 0 {
		maxFPS = opts.MaxFPS
	}

	maxSize := sp.config.MaxSize
	if opts.MaxSize > 0 {
		maxSize = opts.MaxSize
	}

	audio := sp.config.Audio
	if opts.Audio != nil {
		audio = *opts.Audio
	}

	args := []string{
		"/",
		"com.android.helper.CoreService",
		"3.3.4-2af7ccc1",
	}
	if port > 0 {
		args = append(args, fmt.Sprintf("port=%d", port))
	} else if scid >= 0 {
		args = append(args, fmt.Sprintf("scid=%08x", scid))
	}

	args = append(args,
		fmt.Sprintf("max_size=%d", maxSize),
		fmt.Sprintf("video_bit_rate=%d", bitrate),
		fmt.Sprintf("max_fps=%d", maxFPS),
		fmt.Sprintf("audio=%t", audio),
		"send_device_meta=false",
		"send_frame_meta=true",
		"send_codec_meta=true",
		"send_dummy_byte=false",
		"tunnel_forward=false",
		"cleanup=false",
	)

	if opts.VideoSource == "camera" {
		args = append(args, "video_source=camera")
		if opts.CameraFacing != "" {
			args = append(args, fmt.Sprintf("camera_facing=%s", opts.CameraFacing))
		}
		if opts.CameraID != "" {
			args = append(args, fmt.Sprintf("camera_id=%s", opts.CameraID))
		}
		if opts.CameraSize != "" {
			args = append(args, fmt.Sprintf("camera_size=%s", opts.CameraSize))
		}
		if opts.CameraFPS > 0 {
			args = append(args, fmt.Sprintf("camera_fps=%d", opts.CameraFPS))
		}
		if opts.CameraHighSpeed {
			args = append(args, "camera_high_speed=true")
		}
		if opts.CameraAr != "" {
			args = append(args, fmt.Sprintf("camera_ar=%s", opts.CameraAr))
		}
		if opts.CameraZoom > 0 {
			args = append(args, fmt.Sprintf("camera_zoom=%.2f", opts.CameraZoom))
		}
		if opts.CameraOrientation != "" && opts.CameraOrientation != "auto" {
			args = append(args, fmt.Sprintf("capture_orientation=%s", opts.CameraOrientation))
		}
	} else {
		args = append(args, "video_source=display")
	}

	// Audio source selection (mic for surveillance camera or explicit audio_source)
	audioSource := opts.AudioSource
	if audioSource == "" && opts.VideoSource == "camera" {
		audioSource = "mic"
	}
	if audioSource != "" {
		args = append(args, fmt.Sprintf("audio_source=%s", audioSource))
	}

	if opts.AudioDup {
		args = append(args, "audio_dup=true")
	}

	// Remote hardware camera streaming requires stay_awake so device stays awake with screen off
	if opts.StayAwake || opts.VideoSource == "camera" {
		args = append(args, "stay_awake=true")
	}

	videoCodecOpts := sp.config.VideoCodecOptions
	if opts.VideoCodecOptions != "" {
		videoCodecOpts = opts.VideoCodecOptions
	}
	if videoCodecOpts != "" {
		args = append(args, fmt.Sprintf("video_codec_options=%s", videoCodecOpts))
	}

	return args
}

func (sp *ScrcpyProcess) NeedsRestart(opts ScrcpyOptions) bool {
	sp.mu.Lock()
	defer sp.mu.Unlock()

	// 1. Video source change (display <-> camera)
	if opts.VideoSource != "" && opts.VideoSource != sp.currentOptions.VideoSource {
		return true
	}

	// 2. Camera attributes if running in or switching to camera mode
	if opts.VideoSource == "camera" || (opts.VideoSource == "" && sp.currentOptions.VideoSource == "camera") {
		if opts.CameraFacing != "" && opts.CameraFacing != sp.currentOptions.CameraFacing {
			return true
		}
		if opts.CameraID != "" && opts.CameraID != sp.currentOptions.CameraID {
			return true
		}
		if opts.CameraSize != "" && opts.CameraSize != sp.currentOptions.CameraSize {
			return true
		}
		if opts.CameraFPS > 0 && opts.CameraFPS != sp.currentOptions.CameraFPS {
			return true
		}
		if opts.CameraZoom > 0 && opts.CameraZoom != sp.currentOptions.CameraZoom {
			return true
		}
		if opts.CameraOrientation != "" && opts.CameraOrientation != sp.currentOptions.CameraOrientation {
			return true
		}
		if opts.CameraHighSpeed != sp.currentOptions.CameraHighSpeed {
			return true
		}
		if opts.CameraAr != "" && opts.CameraAr != sp.currentOptions.CameraAr {
			return true
		}
	}

	// 3. Resolution, Bitrate and Framerate changes
	if opts.MaxSize > 0 && opts.MaxSize != sp.currentOptions.MaxSize {
		return true
	}

	targetBitrate := opts.VideoBitRate
	if targetBitrate == 0 {
		targetBitrate = opts.Bitrate
	}
	currentBitrate := sp.currentOptions.VideoBitRate
	if currentBitrate == 0 {
		currentBitrate = sp.currentOptions.Bitrate
	}
	if targetBitrate > 0 && currentBitrate > 0 && targetBitrate != currentBitrate {
		return true
	}

	if opts.MaxFPS > 0 && opts.MaxFPS != sp.currentOptions.MaxFPS {
		return true
	}

	// 4. Audio settings
	if opts.Audio != nil {
		if sp.currentOptions.Audio == nil || *opts.Audio != *sp.currentOptions.Audio {
			return true
		}
	}
	if opts.AudioSource != "" && opts.AudioSource != sp.currentOptions.AudioSource {
		return true
	}
	if opts.AudioDup != sp.currentOptions.AudioDup {
		return true
	}

	// 5. Lifecycle and Codec settings
	if opts.StayAwake != sp.currentOptions.StayAwake {
		return true
	}
	if opts.VideoCodecOptions != "" && opts.VideoCodecOptions != sp.currentOptions.VideoCodecOptions {
		return true
	}

	return false
}

func (sp *ScrcpyProcess) SetHandshakeTimeout(d time.Duration) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	sp.handshakeTimeout = d
}

func (sp *ScrcpyProcess) SetOnListeningHook(fn func()) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	sp.onListening = fn
}

func (sp *ScrcpyProcess) GetListenerAddrs() (network, videoAddr, ctrlAddr, audioAddr string) {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	return sp.listenerNet, sp.videoAddr, sp.ctrlAddr, sp.audioAddr
}

func (sp *ScrcpyProcess) Start(streamer *StreamerBridge) error {
	sp.mu.Lock()
	opts := sp.currentOptions
	sp.mu.Unlock()
	return sp.startInternal(opts, streamer, false)
}

func (sp *ScrcpyProcess) Restart(opts ScrcpyOptions, streamer *StreamerBridge) error {
	return sp.startInternal(opts, streamer, true)
}

func (sp *ScrcpyProcess) startInternal(opts ScrcpyOptions, streamer *StreamerBridge, isRestart bool) error {
	sp.startMu.Lock()
	defer sp.startMu.Unlock()

	if isRestart {
		log.Printf("[Scrcpy] Reconfiguring helper: VideoSource=%s, Facing=%s, ID=%s, Size=%s, FPS=%d, Zoom=%.2f, StayAwake=%t",
			opts.VideoSource, opts.CameraFacing, opts.CameraID, opts.CameraSize, opts.CameraFPS, opts.CameraZoom, opts.StayAwake)

		// Atomically reset media generation so new viewers do not receive stale SPS/PPS
		if streamer != nil {
			streamer.ResetSourceGeneration()
		}
	}

	// 1. Cleanup any previously running process or active connections under lock
	sp.mu.Lock()
	if sp.cmd != nil && sp.cmd.Process != nil {
		_ = sp.cmd.Process.Kill()
		_ = sp.cmd.Wait()
		sp.cmd = nil
	}
	if sp.videoConn != nil {
		_ = sp.videoConn.Close()
		sp.videoConn = nil
	}
	if sp.audioConn != nil {
		_ = sp.audioConn.Close()
		sp.audioConn = nil
	}
	if sp.controlConn != nil {
		_ = sp.controlConn.Close()
		sp.controlConn = nil
	}
	sp.currentOptions = opts
	audioEnabled := sp.config.Audio
	if opts.Audio != nil {
		audioEnabled = *opts.Audio
	}
	timeout := sp.handshakeTimeout
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	onListening := sp.onListening
	sp.mu.Unlock()

	// 2. Setup listener for the incoming helper sockets
	networkType := "unix"
	if runtime.GOOS == "windows" {
		networkType = "tcp"
	}

	scid := rand.Int31() & 0x7fffffff
	var listener net.Listener
	var err error
	var port int

	if networkType == "unix" {
		socketName := fmt.Sprintf("scrcpy_%08x", scid)
		listener, err = net.Listen("unix", "@"+socketName)
		if err != nil {
			return fmt.Errorf("failed to listen scrcpy socket: %w", err)
		}
	} else {
		listener, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return fmt.Errorf("failed to listen scrcpy tcp socket: %w", err)
		}
		port = listener.Addr().(*net.TCPAddr).Port
	}

	sp.mu.Lock()
	sp.listenerNet = networkType
	sp.videoAddr = listener.Addr().String()
	sp.ctrlAddr = listener.Addr().String()
	sp.audioAddr = listener.Addr().String()
	sp.mu.Unlock()

	// 3. Launch helper process
	jarPath := sp.config.JarPath
	if jarPath == "" {
		jarPath = "/data/local/tmp/libsys_core.so"
	}

	args := sp.buildArgs(opts, scid, port)

	appProcess := "/system/bin/app_process"
	if _, errStat := os.Stat(appProcess); errStat != nil {
		appProcess = "app_process"
	}

	cmd := exec.Command(appProcess, args...)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("CLASSPATH=%s", jarPath),
		"GODEBUG=asyncpreemptoff=1",
	)
	if sp.config.Root {
		cmd.Env = append(cmd.Env, "CP_AGENT_ROOT=true")
	}

	log.Printf("[Scrcpy] Launching %s with args: %v", appProcess, args)
	if err := cmd.Start(); err != nil {
		log.Printf("[Scrcpy] Note: app_process start failed (running outside Android): %v", err)
	}

	sp.mu.Lock()
	sp.cmd = cmd
	sp.mu.Unlock()

	if onListening != nil {
		go onListening()
	}

	// 4. Accept incoming helper connections
	// Connection sequence from CoreService:
	// 1: Video
	// 2: Audio (if audio enabled)
	// 3 (or 2): Control
	expectedCount := 2
	if audioEnabled {
		expectedCount = 3
	}

	type acceptResult struct {
		conn net.Conn
		err  error
	}
	resultCh := make(chan acceptResult, expectedCount)

	go func() {
		for i := 0; i < expectedCount; i++ {
			c, err := listener.Accept()
			resultCh <- acceptResult{conn: c, err: err}
			if err != nil {
				break
			}
		}
	}()

	timer := time.NewTimer(timeout)
	defer timer.Stop()

	var conns []net.Conn
	var firstErr error

	for i := 0; i < expectedCount; i++ {
		select {
		case res := <-resultCh:
			if res.err != nil {
				if firstErr == nil {
					firstErr = fmt.Errorf("accept error on socket #%d: %w", i+1, res.err)
				}
			} else {
				conns = append(conns, res.conn)
			}
		case <-timer.C:
			firstErr = fmt.Errorf("timeout waiting for scrcpy helper sockets after %v", timeout)
		}
		if firstErr != nil {
			break
		}
	}

	_ = listener.Close()

	// Fail-closed on error or timeout: cleanup and return explicit error
	if firstErr != nil {
		for _, c := range conns {
			if c != nil {
				_ = c.Close()
			}
		}
		sp.mu.Lock()
		if sp.cmd != nil && sp.cmd.Process != nil {
			_ = sp.cmd.Process.Kill()
			sp.cmd = nil
		}
		sp.mu.Unlock()
		return fmt.Errorf("scrcpy socket handshake failed: %w", firstErr)
	}

	var vConn, aConn, cConn net.Conn
	vConn = conns[0]
	if audioEnabled {
		aConn = conns[1]
		cConn = conns[2]
	} else {
		cConn = conns[1]
	}

	// Sockets are connected! Atomically assign state under lock
	sp.mu.Lock()
	sp.videoConn = vConn
	sp.controlConn = cConn
	if sp.control == nil {
		sp.control = NewControlWriter(cConn)
	} else {
		sp.control.UpdateConn(cConn)
	}
	if audioEnabled {
		sp.audioConn = aConn
	}
	cw := sp.control
	sp.mu.Unlock()

	// Drain incoming messages from control socket (AckClipboard, clipboard broadcast, UHID response)
	// so that Android helper's DeviceMessageSender buffer never blocks or throws an IOException
	if cConn != nil {
		go func(conn net.Conn) {
			buf := make([]byte, 4096)
			for {
				_, err := conn.Read(buf)
				if err != nil {
					return
				}
			}
		}(cConn)
	}

	log.Printf("[Scrcpy] CoreService helper sockets connected and verified ready")

	if streamer != nil {
		streamer.SetControlWriter(cw)
		_ = cw.RequestKeyframe()
		go streamer.StreamVideo(vConn)
		if audioEnabled && aConn != nil {
			go streamer.StreamAudio(aConn, streamer.previewStreamer)
		}
	}

	return nil
}

func (sp *ScrcpyProcess) GetControlWriter() *ControlWriter {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	return sp.control
}

func (sp *ScrcpyProcess) GetCurrentOptions() ScrcpyOptions {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	return sp.currentOptions
}

func (sp *ScrcpyProcess) IsAlive() bool {
	sp.mu.Lock()
	defer sp.mu.Unlock()
	return sp.cmd != nil && sp.cmd.Process != nil && sp.videoConn != nil && sp.controlConn != nil
}

func (sp *ScrcpyProcess) Close() {
	sp.startMu.Lock()
	defer sp.startMu.Unlock()

	sp.mu.Lock()
	defer sp.mu.Unlock()

	if sp.control != nil {
		sp.control.Close()
		sp.control = nil
	}
	if sp.videoConn != nil {
		_ = sp.videoConn.Close()
		sp.videoConn = nil
	}
	if sp.audioConn != nil {
		_ = sp.audioConn.Close()
		sp.audioConn = nil
	}
	if sp.controlConn != nil {
		_ = sp.controlConn.Close()
		sp.controlConn = nil
	}
	if sp.cmd != nil && sp.cmd.Process != nil {
		_ = sp.cmd.Process.Kill()
		sp.cmd = nil
	}
}
