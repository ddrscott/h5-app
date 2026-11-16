

export const CircleText = ({className = ''}: {className?: string}) => {
    {/* Curved Text SVG */}
    return <div className={`${className} inset-0 flex items-center justify-center pointer-events-none`}>
        <svg width="300" height="300" viewBox="0 0 300 300"
            className="opacity-20">
            <defs>
                <path id="circlePath" d="M 150, 150 m -80, 0 a 80,80 0 0,1 160,0 a 80,80 0 0,1 -160,0" />
            </defs>
            <g>
                <use xlinkHref="#circlePath" fill="none" />
                <text
                    stroke="#ffd700"
                    fill="#ffd700"
                    fontSize="32"
                    fontFamily="Georgia, serif"
                    fontWeight="900"
                    letterSpacing="1"
                >
                    <textPath xlinkHref="#circlePath">Heart of 5 ★ It's Da Bomb ★ </textPath>
                </text>
            </g>
        </svg>
    </div>
}
