export function PlatformCard({
  id,
  name,
  iconUrl,
  selected,
  onClick
}) {
  return (
    <label
      className={`flex flex-col items-center justify-center p-1 rounded-md cursor-pointer border transition-all ${
        selected 
          ? 'border-primary bg-primary bg-opacity-10 shadow-sm' 
          : 'border-border bg-background-surface hover:bg-background-hover'
      }`}
    >
      <input 
        type="radio" 
        name="platform" 
        value={id} 
        checked={selected} 
        onChange={() => onClick(id)} 
        className="sr-only" 
      />
      <img 
        src={iconUrl} 
        alt={name} 
        className="w-5 h-5 object-contain" 
      />
      <span className="text-xs font-medium mt-1">{name}</span>
    </label>
  );
}

export default PlatformCard;